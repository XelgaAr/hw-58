import { cp, rm, writeFile } from 'node:fs/promises';
import { generateHash, generatePasswordHash } from '../src/main.js';

const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await cp(new URL('../web/', import.meta.url), dist, { recursive: true });
const sha256 = ['', 'Hello, World!', 'Привіт, світе! 🌍'].map(input => ({ input, hash: generateHash(input) }));
const pbkdf2 = [
  { password: 'demo-password', salt: '00112233445566778899aabbccddeeff', iterations: 10000, keylen: 64, digest: 'sha512' },
  { password: 'пароль 🔑', salt: 'сіль 🧂', iterations: 1000, keylen: 32, digest: 'sha256' }
].map(data => ({ ...data, hash: generatePasswordHash(data.password, data.salt, data.iterations, data.keylen, data.digest) }));
await writeFile(new URL('vectors.json', dist), JSON.stringify({ runtime: process.version, sha256, pbkdf2 }, null, 2));
await writeFile(new URL('.nojekyll', dist), '');
console.log('Crypto Lab built in dist/; 5 vectors computed by node:crypto.');
