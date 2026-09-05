const EMAIL_WITH_DOMAIN_EXTENSION = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmailAddress(email: string): boolean {
  return EMAIL_WITH_DOMAIN_EXTENSION.test(email.trim())
}