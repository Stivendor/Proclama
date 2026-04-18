const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!
const MERCADOPAGO_WEBHOOK_URL = Deno.env.get('MERCADOPAGO_WEBHOOK_URL') || 'https://ydyozanakkzpgldqcdjj.supabase.co/functions/v1/mercadopago-webhook'

Deno.serve(async (req) => {
  // This function uses verify: false in config to bypass JWT verification
  // Handle CORS preflight - allow all without auth check
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '3600',
      }
    })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { userId, userEmail, price = 49900, currency = 'COP', successUrl, failureUrl, pendingUrl } = await req.json()

    if (!MERCADOPAGO_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: 'MercadoPago not configured' }), { status: 500 })
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

    if (data.init_point || data.sandbox_init_point) {
return new Response(JSON.stringify(data), { 
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        }
      })
    } else {
      console.error('MercadoPago error:', data)
      return new Response(JSON.stringify({ error: data }), { 
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }
})