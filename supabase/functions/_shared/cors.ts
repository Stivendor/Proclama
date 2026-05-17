export const allowedOrigins = (
  Deno.env.get('ALLOWED_CORS_ORIGINS') ??
  'https://proclama.lat,https://www.proclama.lat,http://localhost:5173,http://localhost:4173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export function buildCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allowOrigin = allowedOrigins.includes(origin) ? origin : 'https://proclama.lat'

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Expose-Headers': 'content-type',
    'Vary': 'Origin',
  }
}
