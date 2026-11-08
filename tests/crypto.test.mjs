import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { generateHash, generatePasswordHash, verifyPassword } from '../src/main.js';
import { deriveHash, hashText, randomSalt } from '../web/crypto.mjs';

const password = 'securePassword123';
const salt = '00112233445566778899aabbccddeeff';
const stored = generatePasswordHash(password, salt);
for (const [input, expected] of [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['Hello, World!', 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f']
])
  test(`SHA-256 known vector: ${input || '(empty)'}`, () => assert.equal(generateHash(input), expected));
test('Different inputs have different SHA-256 hashes', () => assert.notEqual(generateHash('test'), generateHash('test2')));
test('Whitespace is significant for SHA-256', () => assert.notEqual(generateHash('a'), generateHash(' a ')));
test('SHA-256 output is 64 lowercase hexadecimal characters', () => assert.match(generateHash('Привіт 🌍'), /^[a-f0-9]{64}$/));
for (const input of [null, undefined, 42, {}, ['text'], Buffer.from('text')])
  test(`SHA-256 rejects non-string input ${String(input)}`, () => assert.throws(() => generateHash(input), TypeError));
test('PBKDF2 default values match explicit assignment parameters', () => assert.equal(stored, generatePasswordHash(password, salt, 10000, 64, 'sha512')));
test('PBKDF2 is deterministic for equal inputs', () => assert.equal(stored, generatePasswordHash(password, salt)));
test('PBKDF2 changes when the password changes', () => assert.notEqual(stored, generatePasswordHash('another', salt)));
test('PBKDF2 changes when the salt changes', () => assert.notEqual(stored, generatePasswordHash(password, 'different-salt')));
test('PBKDF2-SHA256 known vector, one iteration', () => assert.equal(generatePasswordHash('password', 'salt', 1, 32, 'sha256'), '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b'));
test('PBKDF2 supports custom key length and digest', () => assert.equal(generatePasswordHash(password, salt, 2, 24, 'sha256'), pbkdf2Sync(password, salt, 2, 24, 'sha256').toString('hex')));
test('Empty password and salt remain valid string inputs to the library', () => assert.equal(generatePasswordHash('', '', 1, 16, 'sha256'), pbkdf2Sync('', '', 1, 16, 'sha256').toString('hex')));
for (const [input, inputSalt] of [[null, salt], [42, salt], [password, null], [password, 42]])
  test(`PBKDF2 rejects invalid input types ${input}/${inputSalt}`, () => assert.throws(() => generatePasswordHash(input, inputSalt), TypeError));
for (const iterations of [0, -1, 1.5, NaN, Infinity])
  test(`PBKDF2 rejects invalid iterations ${iterations}`, () => assert.throws(() => generatePasswordHash(password, salt, iterations)));
for (const keylen of [0, -1, 1.5, NaN, Infinity, '32'])
  test(`PBKDF2 rejects invalid key length ${String(keylen)}`, () => assert.throws(() => generatePasswordHash(password, salt, 1, keylen), RangeError));
test('PBKDF2 rejects an unsupported digest', () => assert.throws(() => generatePasswordHash(password, salt, 1, 32, 'not-a-digest')));
test('Verification accepts the correct password', () => assert.equal(verifyPassword(password, stored, salt), true));
test('Verification rejects a wrong password', () => assert.equal(verifyPassword('wrongPassword321', stored, salt), false));
test('Verification rejects a changed salt', () => assert.equal(verifyPassword(password, stored, 'different'), false));
test('Verification rejects changed iterations', () => assert.equal(verifyPassword(password, stored, salt, 9999), false));
test('Verification rejects a changed digest', () => assert.equal(verifyPassword(password, stored, salt, 10000, 64, 'sha256'), false));
test('Verification accepts uppercase hex encoding of the same bytes', () => assert.equal(verifyPassword(password, stored.toUpperCase(), salt), true));
test('Verification supports custom parameters', () => {
  const hash = generatePasswordHash('пароль 🔑', 'сіль 🧂', 2, 24, 'sha256');
  assert.equal(verifyPassword('пароль 🔑', hash, 'сіль 🧂', 2, 24, 'sha256'), true);
});
for (const hash of [null, undefined, 42, {}, '', 'a', stored.slice(2), stored + 'ff', 'z'.repeat(128), ' '.repeat(128), `!${stored.slice(1)}`])
  test(`Verification rejects malformed hash ${String(hash).slice(0, 22) || '(empty)'}`, () => assert.equal(verifyPassword(password, hash, salt), false));
test('Zero-byte hashes cannot authenticate any password', () => assert.equal(verifyPassword('anything', '', salt, 10000, 0), false));
test('Invalid password types do not silently pass verification', () => assert.throws(() => verifyPassword(null, stored, salt), TypeError));
for (const input of ['', 'Hello, World!', 'Привіт, світе! 🌍', 'e\u0301', '\u00e9'])
  test(`Web Crypto SHA-256 agrees with Node for ${input || '(empty)'}`, async () => assert.equal(await hashText(input), generateHash(input)));
for (const [input, inputSalt, iterations, keylen, digest] of [['demo', salt, 10000, 64, 'sha512'], ['пароль 🔑', 'сіль 🧂', 1000, 32, 'sha256'], ['', '', 1, 16, 'sha256']])
  test(`Web Crypto PBKDF2 agrees with Node: ${digest}/${iterations}/${keylen}`, async () => assert.equal(await deriveHash(input, inputSalt, iterations, keylen, digest), generatePasswordHash(input, inputSalt, iterations, keylen, digest)));
test('Generated browser salts contain 16 random bytes represented as hex', () => {
  const salts = Array.from({ length: 20 }, randomSalt);
  salts.forEach(value => assert.match(value, /^[a-f0-9]{32}$/));
  assert.equal(new Set(salts).size, salts.length);
});
for (const [iterations, keylen, digest] of [[0, 64, 'sha512'], [1000001, 64, 'sha512'], [1, 0, 'sha512'], [1, 129, 'sha512'], [1, 64, 'invalid']])
  test(`Browser demo rejects unsupported settings ${iterations}/${keylen}/${digest}`, async () => assert.rejects(deriveHash('p', 's', iterations, keylen, digest), RangeError));
