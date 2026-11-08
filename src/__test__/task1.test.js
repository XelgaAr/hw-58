import { describe, expect, test } from 'vitest'
import { generateHash } from '../main.js'

describe('generateHash', () => {
  test('Повертає правильний SHA-256 хеш для заданого рядка', () => {
    const input = 'Hello, World!'
    const expectedHash = 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f' // Оновлений хеш
    expect(generateHash(input)).toBe(expectedHash)
  })

  test('Повертає різні хеші для різних вхідних рядків', () => {
    const input1 = 'test'
    const input2 = 'test2'
    expect(generateHash(input1)).not.toBe(generateHash(input2))
  })
})
