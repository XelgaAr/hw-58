import { describe, expect, test } from 'vitest'
import { generatePasswordHash } from '../main.js'
import { randomBytes } from 'crypto'

describe('generatePasswordHash', () => {
  const password = 'testPassword'
  const salt = randomBytes(16).toString('hex')
  const iterations = 10000
  const keylen = 64
  const digest = 'sha512'

  test('Повертає консистентний хеш для тих самих вхідних даних', () => {
    const hash1 = generatePasswordHash(password, salt, iterations, keylen, digest)
    const hash2 = generatePasswordHash(password, salt, iterations, keylen, digest)
    expect(hash1).toBe(hash2)
  })

  test('Повертає різні хеші при зміні паролю', () => {
    const newHash = generatePasswordHash('newTestPassword', salt, iterations, keylen, digest)
    const originalHash = generatePasswordHash(password, salt, iterations, keylen, digest)
    expect(newHash).not.toBe(originalHash)
  })

  test('Повертає різні хеші при зміні солі', () => {
    const newSalt = randomBytes(16).toString('hex')
    const newHash = generatePasswordHash(password, newSalt, iterations, keylen, digest)
    const originalHash = generatePasswordHash(password, salt, iterations, keylen, digest)
    expect(newHash).not.toBe(originalHash)
  })
})
