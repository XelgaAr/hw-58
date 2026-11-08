import { describe, expect, test } from 'vitest'
import { generatePasswordHash, verifyPassword } from '../main.js'
import { randomBytes } from 'crypto'

describe('verifyPassword', () => {
  const password = 'securePassword123'
  const salt = randomBytes(16).toString('hex')
  const iterations = 10000
  const keylen = 64
  const digest = 'sha512'
  const storedHash = generatePasswordHash(password, salt, iterations, keylen, digest)

  test('Повертає true для коректного паролю', () => {
    expect(verifyPassword(password, storedHash, salt, iterations, keylen, digest)).toBe(true)
  })

  test('Повертає false для некоректного паролю', () => {
    const wrongPassword = 'wrongPassword321'
    expect(verifyPassword(wrongPassword, storedHash, salt, iterations, keylen, digest)).toBe(false)
  })

  test('Повертає false при зміні солі', () => {
    const newSalt = randomBytes(16).toString('hex')
    expect(verifyPassword(password, storedHash, newSalt, iterations, keylen, digest)).toBe(false)
  })
})
