import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { buildCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth check
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { error: authError } = await supabaseClient.auth.getUser()
  if (authError) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { endpoint, httpMethod = 'GET', parameters = null } = await req.json();

    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'endpoint is required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validate endpoint against allowlist
    const allowedPrefixes = ['/bibles', '/passages', '/search']
    if (!allowedPrefixes.some(p => endpoint.startsWith(p))) {
      return new Response(JSON.stringify({ error: 'Invalid endpoint' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Si existen parameters, append to URL
    let targetUrl = `https://api.scripture.api.bible/v1${endpoint}`;
    if (parameters && Object.keys(parameters).length > 0) {
      const qs = new URLSearchParams(parameters).toString();
      targetUrl += `?${qs}`;
    }

    const apiKey = Deno.env.get('API_BIBLE_KEY');
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API_BIBLE_KEY is missing in Edge Function secrets.' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const fetchOpts: RequestInit = {
      method: httpMethod,
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json',
      }
    };

    const targetRes = await fetch(targetUrl, fetchOpts);
    const data = await targetRes.json();

    return new Response(JSON.stringify(data), {
      status: targetRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
