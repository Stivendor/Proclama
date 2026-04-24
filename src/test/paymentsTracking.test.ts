import { describe, expect, it } from 'vitest'
import {
  buildInitialMercadoPagoPayment,
  deriveMercadoPagoPaymentUpdate,
} from '@/lib/payments'

describe('payments tracking', () => {
  it('crea un registro inicial pending con referencia única para el checkout', () => {
    const payment = buildInitialMercadoPagoPayment({
      paymentId: 'payment-row-1',
      userId: 'user-123',
      payerEmail: 'user@example.com',
      amount: 10000,
      currency: 'COP',
    })

    expect(payment).toMatchObject({
      id: 'payment-row-1',
      user_id: 'user-123',
      provider: 'mercadopago',
      external_reference: 'payment-row-1',
      status: 'pending',
      amount: 10000,
      currency: 'COP',
      product: 'proclama-pro',
      payer_email: 'user@example.com',
    })
  })

  it('deriva actualización aprobada usando provider_payment_id y metadata del usuario', () => {
    const result = deriveMercadoPagoPaymentUpdate({
      id: 12345,
      status: 'approved',
      transaction_amount: 10000,
      currency_id: 'COP',
      external_reference: 'payment-row-1',
      metadata: {
        user_id: 'user-123',
        payment_id: 'payment-row-1',
        product: 'proclama-pro',
      },
    })

    expect(result).toMatchObject({
      paymentRecordId: 'payment-row-1',
      userId: 'user-123',
      update: {
        provider_payment_id: '12345',
        external_reference: 'payment-row-1',
        status: 'approved',
        amount: 10000,
        currency: 'COP',
        product: 'proclama-pro',
      },
    })
  })
})
