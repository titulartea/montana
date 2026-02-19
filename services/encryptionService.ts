const ENCRYPTION_PREFIX = 'montana:enc:v1:';

interface EncryptionPayload {
  salt: string;
  iv: string;
  data: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 180000,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isEncryptedContent(content?: string): boolean {
  return !!content && content.startsWith(ENCRYPTION_PREFIX);
}

export async function encryptNoteContent(plainText: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plainText)
  );

  const payload: EncryptionPayload = {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  };

  return ENCRYPTION_PREFIX + btoa(JSON.stringify(payload));
}

export async function decryptNoteContent(encryptedContent: string, password: string): Promise<string> {
  if (!isEncryptedContent(encryptedContent)) {
    throw new Error('암호화된 노트가 아닙니다.');
  }

  const payloadRaw = encryptedContent.slice(ENCRYPTION_PREFIX.length);
  const payload = JSON.parse(atob(payloadRaw)) as EncryptionPayload;

  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const data = base64ToBytes(payload.data);

  const key = await deriveKey(password, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return decoder.decode(decrypted);
  } catch {
    throw new Error('비밀번호가 올바르지 않거나 노트 데이터가 손상되었습니다.');
  }
}
