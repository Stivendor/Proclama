import { WHATSAPP_NUMBER } from '@/constants/plans'

export type BillingPeriod = 'monthly' | 'annual'

export function formatCOP(n: number): string {
  return '$' + new Intl.NumberFormat('es-CO').format(n)
}

export function subscribeWhatsappUrl(period: BillingPeriod, email?: string): string {
  const planLabel = period === 'annual' ? 'Anual' : 'Mensual'
  const emailPart = email ? ` Mi correo de la cuenta es ${email}.` : ''
  const msg = `¡Hola! 👋 Quiero suscribirme a Proclama Pro — plan ${planLabel}.${emailPart} ¿Cómo hago el pago?`
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
}

export function isTrialEligible(args: { isPremium: boolean; trialStartedAt: string | null }): boolean {
  return !args.isPremium && args.trialStartedAt == null
}
