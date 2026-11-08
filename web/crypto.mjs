const encode = value => new TextEncoder().encode(value);
const toHex = buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');

export const hashText = async input => toHex(await crypto.subtle.digest('SHA-256', encode(input)));
export const randomSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));
export const deriveHash = async (password, salt, iterations = 10000, keylen = 64, digest = 'sha512') => {
  const hash = { sha256: 'SHA-256', sha512: 'SHA-512' }[digest];
  if (!hash || !Number.isInteger(iterations) || iterations < 1 || iterations > 1000000 || !Number.isInteger(keylen) || keylen < 1 || keylen > 128)
    throw new RangeError('Допустимо 1–1 000 000 итераций, 1–128 байт, SHA-256 или SHA-512.');
  const key = await crypto.subtle.importKey('raw', encode(password), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash, salt: encode(salt), iterations }, key, keylen * 8));
};
