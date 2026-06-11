import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const password = process.env.FITNESS_PASSWORD || 'musculos';
const input = readFileSync(join(root, 'data', 'fitness.raw.json'));
const enc = new TextEncoder();
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const keyMaterial = await webcrypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await webcrypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt']
);
const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, input));
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const payload = {
  version: 1,
  algorithm: 'PBKDF2-SHA256+AES-256-GCM',
  kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 250000, salt: b64(salt) },
  cipher: { name: 'AES-GCM', iv: b64(iv) },
  ciphertext: b64(ciphertext)
};
writeFileSync(join(root, 'data', 'fitness.encrypted.json'), JSON.stringify(payload));
console.log('Wrote data/fitness.encrypted.json');
