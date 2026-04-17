import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload: MercadoPagoWebhookPayload = await req.json()

    console.log(`MercadoPago webhook received: ${payload.type}`)

    // Handle payment notification
    if (payload.type === 'payment') {
      const paymentId = payload.data.id
      const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')

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

        const paymentData = await paymentResponse.json()
        console.log('Payment status:', paymentData.status)

        if (paymentData.status === 'approved') {
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