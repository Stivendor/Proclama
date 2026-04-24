import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildInitialMercadoPagoPayment } from '../_shared/payments.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const serviceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mercadoPagoAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    const mercadoPagoWebhookUrl =
      Deno.env.get('MERCADOPAGO_WEBHOOK_URL') ??
      'https://ydyozanakkzpgldqcdjj.supabase.co/functions/v1/mercadopago-webhook'
    const envPrice = Deno.env.get('PRO_PLAN_PRICE')
    const price = envPrice ? parseInt(envPrice, 10) : 99900
    const currency = 'COP'

    if (!mercadoPagoAccessToken) {
      return new Response(JSON.stringify({ error: 'MercadoPago access token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = {
      id: crypto.randomUUID(),
      transaction_amount: price,
      description: 'Proclama Pro',
      items: [
        {
          title: 'Proclama Pro',
          description: 'Acceso de por vida a Proclama Pro',
          unit_price: price,
          quantity: 1,
          currency_id: currency,
        },
      ],
      payer: {
        email: user.email,
      },
      external_reference: crypto.randomUUID(),
      notification_url: mercadoPagoWebhookUrl,
      back_urls: {
        success: 'https://proclama.lat',
        failure: 'https://proclama.lat',
        pending: 'https://proclama.lat',
      },
      payment_methods: {
        installments: 1,
      },
      metadata: {
        product: 'proclama-pro',
        plan: 'premium-lifetime',
        user_id: user.id,
      },
    }

    const paymentRecord = buildInitialMercadoPagoPayment({
      paymentId: payload.external_reference,
      userId: user.id,
      payerEmail: user.email,
      amount: price,
      currency,
    })

    const { error: insertPaymentError } = await serviceRoleClient
      .from('payments')
      .insert({
        ...paymentRecord,
        preference_payload: payload,
      })

    if (insertPaymentError) {
      console.error('Failed to create pending payment record:', insertPaymentError)
      return new Response(JSON.stringify({ error: 'Failed to initialize payment tracking' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      await serviceRoleClient
        .from('payment_errors')
        .insert({
          payment_id: paymentRecord.id,
          provider: 'mercadopago',
          code: 'preference_creation_failed',
          message: 'MercadoPago preference creation failed',
          context: data,
        })

      await serviceRoleClient
        .from('payments')
        .update({
          status: 'cancelled',
          preference_payload: data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentRecord.id)
    } else {
      await serviceRoleClient
        .from('payments')
        .update({
          provider_preference_id: data?.id ?? null,
          preference_payload: data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentRecord.id)
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Critical Error:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
