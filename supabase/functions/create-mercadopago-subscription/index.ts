import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildInitialMercadoPagoPayment } from '../_shared/payments.ts'

import { buildCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

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

    const { planType, successUrl } = await req.json().catch(() => ({ planType: 'monthly' }))

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
    
    // We get the prices from environment or default to 19900 monthly, 199900 annual
    const envPriceMonthly = Deno.env.get('PRO_PLAN_PRICE_MONTHLY')
    const envPriceAnnual = Deno.env.get('PRO_PLAN_PRICE_ANNUAL')
    
    const isAnnual = planType === 'annual'
    const rawPrice = isAnnual
      ? (envPriceAnnual ? parseInt(envPriceAnnual, 10) : 220000)
      : (envPriceMonthly ? parseInt(envPriceMonthly, 10) : 25000)

    if (isNaN(rawPrice)) {
      return new Response(JSON.stringify({ error: 'Precio inválido configurado en el servidor' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const price = rawPrice
    const currency = 'COP'

    if (!mercadoPagoAccessToken) {
      return new Response(JSON.stringify({ error: 'MercadoPago server configuration is incomplete' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const externalRef = crypto.randomUUID()

    const backUrl = typeof successUrl === 'string' && successUrl.startsWith('https://')
      ? successUrl
      : 'https://proclama.lat'

    const payload = {
      reason: isAnnual ? 'Proclama Pro - Suscripción Anual' : 'Proclama Pro - Suscripción Mensual',
      auto_recurring: {
        frequency: isAnnual ? 12 : 1,
        frequency_type: 'months',
        transaction_amount: price,
        currency_id: currency,
      },
      back_url: backUrl,
      payer_email: user.email,
      external_reference: externalRef,
    }

    const paymentRecord = buildInitialMercadoPagoPayment({
      paymentId: externalRef,
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

    const response = await fetch('https://api.mercadopago.com/preapproval', {
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
          code: 'preapproval_creation_failed',
          message: 'MercadoPago preapproval creation failed',
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
