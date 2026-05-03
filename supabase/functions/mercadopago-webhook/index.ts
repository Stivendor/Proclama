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

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://proclama.lat',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Handle payment notification
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

        if (isApprovedProPayment(paymentData, { expectedAmount, expectedCurrency })) {
          const targetUserId = derived.userId
          
          if (targetUserId) {
            const { error } = await supabaseClient
              .from('profiles')
              .update({
                plan: 'premium',
                updated_at: new Date().toISOString()
              })
              .eq('id', targetUserId)

            if (error) {
              console.error('Error updating user to premium:', error)
              if (trackedPaymentId) {
                await supabaseClient
                  .from('payments')
                  .update({
                    premium_activation_error: error.message,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', trackedPaymentId)
              }

              await supabaseClient.from('payment_errors').insert(
                buildPaymentError({
                  paymentId: trackedPaymentId,
                  code: 'premium_activation_failed',
                  message: error.message,
                  context: { userId: targetUserId },
                })
              )

              if (adminEmail) {
                await supabaseClient.from('payment_notifications').upsert(
                  buildPaymentNotification({
                    paymentId: trackedPaymentId,
                    recipientEmail: adminEmail,
                    template: 'payment_admin_alert',
                    payload: {
                      reason: 'premium_activation_failed',
                      userId: targetUserId,
                      paymentId: trackedPaymentId,
                    },
                  }),
                  { onConflict: 'payment_id,recipient_email,template' }
                )
              }
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

                if (payerEmail) {
                  await supabaseClient.from('payment_notifications').upsert(
                    buildPaymentNotification({
                      paymentId: trackedPaymentId,
                      recipientEmail: payerEmail,
                      template: 'payment_approved',
                      payload: {
                        userId: targetUserId,
                        paymentId: trackedPaymentId,
                        amount: paymentData.transaction_amount,
                        currency: paymentData.currency_id,
                      },
                    }),
                    { onConflict: 'payment_id,recipient_email,template' }
                  )
                }
              }

              console.log(`User ${targetUserId} upgraded to premium`)
            }
          }
        } else {
          if (trackedPaymentId && payerEmail) {
            await supabaseClient.from('payment_notifications').upsert(
              buildPaymentNotification({
                paymentId: trackedPaymentId,
                recipientEmail: payerEmail,
                template: 'payment_status_update',
                payload: {
                  status: paymentData.status,
                  paymentId: trackedPaymentId,
                  amount: paymentData.transaction_amount,
                  currency: paymentData.currency_id,
                },
              }),
              { onConflict: 'payment_id,recipient_email,template' }
            )
          }

          console.warn('Ignoring MercadoPago payment that does not match Pro rules', {
            paymentId,
            status: paymentData.status,
            transactionAmount: paymentData.transaction_amount,
            currencyId: paymentData.currency_id,
            externalReference: paymentData.external_reference,
            metadata: paymentData.metadata,
          })
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
