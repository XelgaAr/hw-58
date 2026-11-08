import { randomBytes } from 'node:crypto';
import { generateHash, generatePasswordHash, verifyPassword } from '../src/main.js';

const salt = randomBytes(16).toString('hex');
const hash = generatePasswordHash('demo-password', salt);
console.log('SHA-256:', generateHash('Hello, World!'));
console.log('Salt:', salt);
console.log('PBKDF2-SHA512 / 10000 iterations / 64 bytes:', hash);
console.log('Correct password:', verifyPassword('demo-password', hash, salt));
console.log('Wrong password:', verifyPassword('wrong-password', hash, salt));
