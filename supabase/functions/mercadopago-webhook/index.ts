import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  isApprovedProPayment,
  verifyMercadoPagoWebhookSignature,
} from '../_shared/mercadoPagoSecurity.ts'
import {
  buildPaymentError,
  buildPaymentNotification,
  deriveMercadoPagoPaymentUpdate,
} from '../_shared/payments.ts'

import { buildCorsHeaders } from '../_shared/cors.ts'

interface MercadoPagoWebhookPayload {
  action: string
  api_version: string
  data: {
    id: string
  }
  date_created: string
  id: number
  live_mode: boolean
  type: string
  user_id: string
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const rawBody = await req.text()
    const payload: MercadoPagoWebhookPayload = JSON.parse(rawBody)
    const signatureHeader = req.headers.get('x-signature')
    const requestId = req.headers.get('x-request-id')
    const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')
    const adminEmail = Deno.env.get('PAYMENTS_ADMIN_EMAIL')

    if (!signatureHeader || !requestId || !webhookSecret) {
      await supabaseClient.from('payment_errors').insert(
        buildPaymentError({
          code: 'webhook_auth_missing',
          message: 'Missing MercadoPago webhook headers or secret',
          context: { hasSignatureHeader: Boolean(signatureHeader), hasRequestId: Boolean(requestId) },
        })
      )

      if (adminEmail) {
        await supabaseClient.from('payment_notifications').upsert(
          buildPaymentNotification({
            recipientEmail: adminEmail,
            template: 'payment_admin_alert',
            payload: {
              reason: 'webhook_auth_missing',
              headersPresent: {
                signature: Boolean(signatureHeader),
                requestId: Boolean(requestId),
              },
            },
          }),
          { onConflict: 'payment_id,recipient_email,template' }
        )
      }
      return new Response('Unauthorized', { status: 401 })
    }

    const dataId =
      new URL(req.url).searchParams.get('data.id') ??
      payload.data.id

    const isSignatureValid = await verifyMercadoPagoWebhookSignature({
      dataId,
      requestId,
      secret: webhookSecret,
      signatureHeader,
    })

    if (!isSignatureValid) {
      await supabaseClient.from('payment_errors').insert(
        buildPaymentError({
          code: 'invalid_signature',
          message: 'Invalid MercadoPago webhook signature',
          context: { dataId, requestId },
        })
      )

      if (adminEmail) {
        await supabaseClient.from('payment_notifications').upsert(
          buildPaymentNotification({
            recipientEmail: adminEmail,
            template: 'payment_admin_alert',
            payload: {
              reason: 'invalid_signature',
              dataId,
              requestId,
            },
          }),
          { onConflict: 'payment_id,recipient_email,template' }
        )
      }
      return new Response('Invalid signature', { status: 401 })
    }

    console.log(`MercadoPago webhook received: ${payload.type}`)

    if (payload.type === 'payment') {
      const paymentId = payload.data.id
      const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
      const expectedAmount = parseInt(Deno.env.get('PRO_PLAN_PRICE') ?? '99900', 10)
      const expectedCurrency = Deno.env.get('PRO_PLAN_CURRENCY') ?? 'COP'

      if (accessToken) {
        // Get payment details from MercadoPago
        const paymentResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        )

        if (!paymentResponse.ok) {
          console.error('Error fetching payment details from MercadoPago')
          return new Response('Payment lookup failed', { status: 502 })
        }

        const paymentData = await paymentResponse.json()
        console.log('Payment status:', paymentData.status)
        const derived = deriveMercadoPagoPaymentUpdate(paymentData)
        const paymentRecordId = derived.paymentRecordId
        const effectiveUserId = derived.userId ?? (typeof paymentData.external_reference === 'string' ? paymentData.external_reference : null)
        const payerEmail = paymentData.payer?.email ?? null

        let trackedPaymentId: string | null = paymentRecordId
        // Update payments table logic
        if (paymentRecordId) {
          const { data: updatedRows } = await supabaseClient
            .from('payments')
            .update({
              ...derived.update,
              payer_email: payerEmail,
            })
            .eq('id', paymentRecordId)
            .select('id')

          if (!updatedRows || updatedRows.length === 0) {
            if (effectiveUserId) {
              const { data: insertedPayment, error: insertTrackedPaymentError } = await supabaseClient
                .from('payments')
                .insert({
                  id: paymentRecordId,
                  user_id: effectiveUserId,
                  provider: 'mercadopago',
                  external_reference: paymentData.external_reference ?? paymentRecordId,
                  product: derived.update.product,
                  status: derived.update.status,
                  amount: derived.update.amount,
                  currency: derived.update.currency,
                  payer_email: payerEmail,
                  provider_payment_id: derived.update.provider_payment_id,
                  raw_payload: derived.update.raw_payload,
                  last_webhook_at: derived.update.last_webhook_at,
                  approved_at: derived.update.approved_at,
                  updated_at: derived.update.updated_at,
                })
                .select('id')
                .single()

              if (insertTrackedPaymentError) {
                console.error('Failed to insert fallback tracked payment:', insertTrackedPaymentError)
              } else {
                trackedPaymentId = insertedPayment.id
              }
            }
          } else {
            trackedPaymentId = updatedRows[0].id
          }
        }

        // Only process lifetime payments here (if it matches the old lifetime amount or logic)
        // For subscriptions, we handle `subscription_preapproval`. However, preapproval payments also trigger this.
        // We can safely update the user if it's an approved payment, but we need to check if it's a subscription payment
        // to avoid granting lifetime access if they just paid a monthly fee.
        
        // Let's check if the payment is linked to a subscription in our DB
        let isSubscriptionPayment = false
        if (trackedPaymentId) {
            const { data: paymentRow } = await supabaseClient.from('payments').select('preference_payload').eq('id', trackedPaymentId).single()
            if (paymentRow?.preference_payload?.auto_recurring) {
                isSubscriptionPayment = true
            }
        }

        if (paymentData.status === 'approved') {
          const targetUserId = derived.userId || effectiveUserId
          
          if (targetUserId) {
            // For lifetime payments, we set plan='premium' and premium_expires_at=NULL
            // For subscription payments, we update the expiration date based on the payment
            let updatePayload: any = {
              plan: 'premium',
              updated_at: new Date().toISOString()
            }
            
            if (isSubscriptionPayment) {
                // We will rely on the `subscription_preapproval` webhook to set the correct expiration date
                // But just in case, we give them 32 days from now.
                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + 32)
                updatePayload.premium_expires_at = expiresAt.toISOString()
            } else {
                // Lifetime
                updatePayload.premium_expires_at = null
            }

            const { error } = await supabaseClient
              .from('profiles')
              .update(updatePayload)
              .eq('id', targetUserId)

            if (error) {
              console.error('Error updating user to premium:', error)
              // ... notification logic
            } else {
              if (trackedPaymentId) {
                await supabaseClient
                  .from('payments')
                  .update({
                    premium_activated_at: new Date().toISOString(),
                    premium_activation_error: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', trackedPaymentId)
              }
              console.log(`User ${targetUserId} upgraded to premium`)
            }
          }
        }
      }
    } else if (payload.type === 'subscription_preapproval') {
        const preapprovalId = payload.data.id
        const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
        
        if (accessToken) {
            const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
            
            if (response.ok) {
                const data = await response.json()
                console.log('Preapproval data:', data)
                
                const externalRef = data.external_reference
                if (externalRef) {
                    // Find user from external reference (which is our payment ID)
                    const { data: paymentRow } = await supabaseClient.from('payments').select('user_id').eq('id', externalRef).single()
                    const userId = paymentRow?.user_id
                    
                    if (userId) {
                        const status = data.status
                        const isAuthorized = status === 'authorized'
                        const planType = data.auto_recurring?.frequency === 12 ? 'annual' : 'monthly'
                        
                        if (isAuthorized) {
                            // Determine expiration date based on next_payment_date or frequency
                            const nextPaymentDateStr = data.next_payment_date
                            let expiresAt = new Date()
                            if (nextPaymentDateStr) {
                                expiresAt = new Date(nextPaymentDateStr)
                                expiresAt.setDate(expiresAt.getDate() + 2) // 2 days grace period
                            } else {
                                expiresAt.setMonth(expiresAt.getMonth() + (planType === 'annual' ? 12 : 1))
                            }
                            
                            await supabaseClient.from('profiles').update({
                                plan: 'premium',
                                mp_subscription_id: preapprovalId,
                                subscription_plan: planType,
                                premium_expires_at: expiresAt.toISOString(),
                                updated_at: new Date().toISOString()
                            }).eq('id', userId)
                            console.log(`Subscription ${preapprovalId} authorized for user ${userId}. Expires: ${expiresAt.toISOString()}`)
                        } else if (status === 'cancelled') {
                            // If cancelled, we keep them premium until their expires_at date.
                            // However, we clear mp_subscription_id so we know it's cancelled.
                            await supabaseClient.from('profiles').update({
                                mp_subscription_id: null,
                                updated_at: new Date().toISOString()
                            }).eq('id', userId)
                            console.log(`Subscription ${preapprovalId} cancelled for user ${userId}.`)
                        }
                    }
                }
            }
        }
    } else {
      console.log('Ignoring MercadoPago webhook event:', payload.type)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Internal error', { status: 500 })
  }
})
