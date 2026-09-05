import { describe, expect, it } from 'vitest'
import { isValidEmailAddress } from '@/services/emailValidation'

describe('isValidEmailAddress', () => {
  it('rejects an email without a domain extension', () => {
    expect(isValidEmailAddress('ejemplo@hotmail')).toBe(false)
  })

  it('rejects an email without a complete address', () => {
    expect(isValidEmailAddress('@gimail')).toBe(false)
  })

  it('accepts an email with a domain extension', () => {
    expect(isValidEmailAddress('ejemplo@hotmail.com')).toBe(true)
  })
})