type InitialMercadoPagoPaymentInput = {
  paymentId: string
  userId: string
  payerEmail: string | null | undefined
  amount: number
  currency: string
}

type MercadoPagoPaymentDetails = {
  id?: number | string
  status?: string
  transaction_amount?: number
  currency_id?: string
  external_reference?: string
  metadata?: {
    user_id?: string
    payment_id?: string
    product?: string
  }
}

export function buildInitialMercadoPagoPayment({
  paymentId,
  userId,
  payerEmail,
  amount,
  currency,
}: InitialMercadoPagoPaymentInput) {
  const now = new Date().toISOString()

  return {
    id: paymentId,
    user_id: userId,
    provider: 'mercadopago',
    external_reference: paymentId,
    status: 'pending',
    amount,
    currency,
    product: 'proclama-pro',
    payer_email: payerEmail ?? null,
    created_at: now,
    updated_at: now,
  }
}

export function deriveMercadoPagoPaymentUpdate(payment: MercadoPagoPaymentDetails) {
  const paymentRecordId =
    payment.metadata?.payment_id ??
    payment.external_reference ??
    null

  const userId =
    payment.metadata?.user_id ??
    null

  const now = new Date().toISOString()

  return {
    paymentRecordId,
    userId,
    update: {
      provider_payment_id: payment.id ? String(payment.id) : null,
      external_reference: payment.external_reference ?? null,
      status: payment.status ?? 'unknown',
      amount: payment.transaction_amount ?? null,
      currency: payment.currency_id ?? null,
      product: payment.metadata?.product ?? 'unknown',
      raw_payload: payment,
      last_webhook_at: now,
      approved_at: payment.status === 'approved' ? now : null,
      updated_at: now,
    },
  }
}

export function buildPaymentNotification({
  paymentId,
  recipientEmail,
  template,
  payload,
}: {
  paymentId?: string | null
  recipientEmail: string
  template: string
  payload: Record<string, unknown>
}) {
  return {
    payment_id: paymentId ?? null,
    recipient_email: recipientEmail,
    template,
    status: 'pending',
    payload,
  }
}

export function buildPaymentError({
  paymentId,
  code,
  message,
  context,
}: {
  paymentId?: string | null
  code: string
  message: string
  context?: Record<string, unknown>
}) {
  return {
    payment_id: paymentId ?? null,
    provider: 'mercadopago',
    code,
    message,
    context: context ?? null,
  }
}
