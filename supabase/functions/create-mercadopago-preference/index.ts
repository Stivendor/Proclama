const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    const MERCADOPAGO_WEBHOOK_URL = Deno.env.get('MERCADOPAGO_WEBHOOK_URL') || '***REMOVED***/functions/v1/mercadopago-webhook'

    const body = await req.text()
    console.log('Request body:', body)
    
    if (!body) {
      return new Response(JSON.stringify({ error: 'Empty body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    const { userId, userEmail, price = 49900, currency = 'COP', successUrl, failureUrl, pendingUrl } = JSON.parse(body)

    if (!MERCADOPAGO_ACCESS_TOKEN) {
      console.error('MercadoPago token not set')
      return new Response(JSON.stringify({ error: 'MercadoPago not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const payload = {
      transaction_amount: price,
      description: 'Proclama Pro',
      items: [
        {
          title: 'Proclama Pro',
          description: 'Acceso de por vida a Proclama Pro',
          unit_price: price,
          quantity: 1,
          currency_id: currency
        }
      ],
      payer: {
        email: userEmail || 'cliente@proclama.app'
      },
      external_reference: userId || crypto.randomUUID(),
      notification_url: MERCADOPAGO_WEBHOOK_URL,
      back_urls: {
        success: successUrl || 'https://proclama.lat',
        failure: failureUrl || 'https://proclama.lat',
        pending: pendingUrl || 'https://proclama.lat'
      },
      payment_methods: {
        installments: 1
      }
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()
    console.log('MP response:', data)

    if (!response.ok) {
      console.error('MP error:', data)
      return new Response(JSON.stringify({ error: data }), { status: 400 })
    }

    if (data.init_point || data.sandbox_init_point) {
return new Response(JSON.stringify(data), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      console.error('MercadoPago error:', data)
      return new Response(JSON.stringify({ error: data }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})