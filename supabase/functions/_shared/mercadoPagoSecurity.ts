type SignatureParts = {
  ts: string
  v1: string
}

type VerifySignatureInput = {
  dataId: string
  requestId: string
  secret: string
  signatureHeader: string
}

type ApprovedPaymentInput = {
  status?: string
  transaction_amount?: number
  currency_id?: string
  external_reference?: string
  metadata?: {
    product?: string
  }
}

type ApprovedPaymentRules = {
  expectedAmount: number
  expectedCurrency: string
}

function parseMercadoPagoSignatureHeader(signatureHeader: string): SignatureParts | null {
  const parts = signatureHeader.split(',')
  let ts = ''
  let v1 = ''

  for (const part of parts) {
    const [rawKey, rawValue] = part.split('=', 2)
    const key = rawKey?.trim()
    const value = rawValue?.trim()

    if (!key || !value) continue
    if (key === 'ts') ts = value
    if (key === 'v1') v1 = value
  }

  if (!ts || !v1) return null
  return { ts, v1 }
}

export function buildMercadoPagoWebhookManifest({
  dataId,
  requestId,
  ts,
}: {
  dataId: string
  requestId: string
  ts: string
}): string {
  const normalizedDataId = dataId.trim().toLowerCase()
  const parts = [
    normalizedDataId ? `id:${normalizedDataId};` : '',
    requestId.trim() ? `request-id:${requestId.trim()};` : '',
    ts.trim() ? `ts:${ts.trim()};` : '',
  ]

  return parts.join('')
}

async function signMercadoPagoManifest(secret: string, manifest: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyMercadoPagoWebhookSignature({
  dataId,
  requestId,
  secret,
  signatureHeader,
}: VerifySignatureInput): Promise<boolean> {
  const parsed = parseMercadoPagoSignatureHeader(signatureHeader)
  if (!parsed) return false

  const manifest = buildMercadoPagoWebhookManifest({
    dataId,
    requestId,
    ts: parsed.ts,
  })

  if (!manifest) return false

  const expectedSignature = await signMercadoPagoManifest(secret, manifest)
  return expectedSignature === parsed.v1
}

export function isApprovedProPayment(
  payment: ApprovedPaymentInput,
  rules: ApprovedPaymentRules,
): boolean {
  return (
    payment.status === 'approved' &&
    payment.transaction_amount === rules.expectedAmount &&
    payment.currency_id === rules.expectedCurrency &&
    Boolean(payment.external_reference) &&
    payment.metadata?.product === 'proclama-pro'
  )
}
