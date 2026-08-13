const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const encoded = process.env.TALQS_KEY_ENCRYPTION_SECRET ?? "";
  let raw: Uint8Array;
  try {
    raw = fromBase64(encoded);
  } catch {
    throw new Error("The credential encryption secret is not valid base64.");
  }
  if (raw.byteLength !== 32) {
    throw new Error("TALQS_KEY_ENCRYPTION_SECRET must contain exactly 32 random bytes.");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptCredential(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    encoder.encode(value),
  );
  return {
    encryptedKey: toBase64(new Uint8Array(ciphertext)),
    keyIv: toBase64(iv),
  };
}

export async function decryptCredential(encryptedKey: string, keyIv: string) {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(keyIv) },
    await encryptionKey(),
    fromBase64(encryptedKey),
  );
  return decoder.decode(plaintext);
}

