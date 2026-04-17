import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: 'order_created' | 'subscription_created' | 'subscription_updated' | 'subscription_cancelled'
    custom_data?: {
      user_id?: string
      email?: string
    }
  }
  data: {
    attributes: {
      status?: string
      first_order_item?: {
        product_id?: number
        variant_id?: number
      }
    }
    id: string
  }
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

    const payload: LemonSqueezyWebhookPayload = await req.json()

    const eventName = payload.meta.event_name
    const userId = payload.meta.custom_data?.user_id

    console.log(`Full webhook payload:`, JSON.stringify(payload, null, 2))
    console.log(`Processing webhook event: ${eventName}, userId: ${userId}`)

    if (eventName === 'order_created' || eventName === 'subscription_created') {
      if (userId) {
        const { error } = await supabaseClient
          .from('profiles')
          .update({ 
            plan: 'premium',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (error) {
          console.error('Error updating user to premium:', error)
          return new Response('Error updating profile', { status: 500 })
        }

        console.log(`User ${userId} upgraded to premium`)
      }
    }

    if (eventName === 'subscription_cancelled') {
      if (userId) {
        const { error } = await supabaseClient
          .from('profiles')
          .update({ 
            plan: 'free',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (error) {
          console.error('Error downgrading user to free:', error)
          return new Response('Error updating profile', { status: 500 })
        }

        console.log(`User ${userId} downgraded to free`)
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
