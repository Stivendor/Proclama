import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  isApprovedProPayment,
  verifyMercadoPagoWebhookSignature,
} from '../../../src/lib/mercadoPagoSecurity.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
    const rawBody = await req.text()
    const payload: MercadoPagoWebhookPayload = JSON.parse(rawBody)
    const signatureHeader = req.headers.get('x-signature')
    const requestId = req.headers.get('x-request-id')
    const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')

    if (!signatureHeader || !requestId || !webhookSecret) {
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
      return new Response('Invalid signature', { status: 401 })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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

        if (isApprovedProPayment(paymentData, { expectedAmount, expectedCurrency })) {
          const externalReference = paymentData.external_reference
          
          if (externalReference) {
            const { error } = await supabaseClient
              .from('profiles')
              .update({
                plan: 'premium',
                updated_at: new Date().toISOString()
              })
              .eq('id', externalReference)

            if (error) {
              console.error('Error updating user to premium:', error)
            } else {
              console.log(`User ${externalReference} upgraded to premium`)
            }
          }
        } else {
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
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Internal error', { status: 500 })
  }
})
