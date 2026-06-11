// Decrypts the dashboard payload: PBKDF2-SHA256 -> AES-256-GCM.
// Format matches data/fitness.encrypted.json: { kdf: { salt, iterations, hash }, cipher: { iv }, ciphertext } (all base64).

function b64ToBytes(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export async function decryptFitnessPayload(passphrase, encObj) {
  const te = new TextEncoder();
  const salt = b64ToBytes(encObj.kdf.salt);
  const iv = b64ToBytes(encObj.cipher.iv);
  const ct = b64ToBytes(encObj.ciphertext);
  const keyMat = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: encObj.kdf.hash || 'SHA-256', salt, iterations: encObj.kdf.iterations || 250000 },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}
