import { describe, expect, it } from 'vitest'
import {
  buildMercadoPagoWebhookManifest,
  isApprovedProPayment,
  verifyMercadoPagoWebhookSignature,
} from '../lib/mercadoPagoSecurity'

async function signManifest(secret: string, manifest: string): Promise<string> {
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

describe('mercadoPagoSecurity', () => {
  it('verifica una firma valida del webhook de MercadoPago', async () => {
    const secret = 'super-secret'
    const manifest = buildMercadoPagoWebhookManifest({
      dataId: '123456',
      requestId: 'req-123',
      ts: '1704908010',
    })
    const digest = await signManifest(secret, manifest)

    const isValid = await verifyMercadoPagoWebhookSignature({
      dataId: '123456',
      requestId: 'req-123',
      secret,
      signatureHeader: `ts=1704908010,v1=${digest}`,
    })

    expect(isValid).toBe(true)
  })

  it('rechaza una firma invalida del webhook de MercadoPago', async () => {
    const isValid = await verifyMercadoPagoWebhookSignature({
      dataId: '123456',
      requestId: 'req-123',
      secret: 'super-secret',
      signatureHeader: 'ts=1704908010,v1=bad-signature',
    })

    expect(isValid).toBe(false)
  })

  it('acepta solo pagos aprobados del producto esperado con monto y moneda correctos', () => {
    const result = isApprovedProPayment(
      {
        status: 'approved',
        transaction_amount: 99900,
        currency_id: 'COP',
        external_reference: 'user-123',
        metadata: {
          product: 'proclama-pro',
        },
      },
      {
        expectedAmount: 99900,
        expectedCurrency: 'COP',
      },
    )

    expect(result).toBe(true)
  })

  it('rechaza pagos aprobados con monto alterado o metadata incorrecta', () => {
    const badAmount = isApprovedProPayment(
      {
        status: 'approved',
        transaction_amount: 1000,
        currency_id: 'COP',
        external_reference: 'user-123',
        metadata: {
          product: 'proclama-pro',
        },
      },
      {
        expectedAmount: 99900,
        expectedCurrency: 'COP',
      },
    )

    const badMetadata = isApprovedProPayment(
      {
        status: 'approved',
        transaction_amount: 99900,
        currency_id: 'COP',
        external_reference: 'user-123',
        metadata: {
          product: 'other-product',
        },
      },
      {
        expectedAmount: 99900,
        expectedCurrency: 'COP',
      },
    )

    expect(badAmount).toBe(false)
    expect(badMetadata).toBe(false)
  })
})
