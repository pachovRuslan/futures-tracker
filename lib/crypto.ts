import crypto from "crypto";

// Шифруем API-ключи бирж перед записью в БД — даже при утечке дампа базы
// голые ключи не достанешь без ENCRYPTION_KEY (который лежит только в env
// сервера, никогда в БД).
//
// ENCRYPTION_KEY — 32 байта в base64. Сгенерировать:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

function getKey(): Buffer {
  const b64 = process.env.ENCRYPTION_KEY;
  if (!b64) throw new Error("ENCRYPTION_KEY не задан в переменных окружения");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY должен декодироваться в ровно 32 байта");
  }
  return key;
}

// Формат хранения: base64(iv[12] + authTag[16] + ciphertext)
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

// Для отображения в UI — не показываем ключ целиком, только последние 4 символа
export function maskKey(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return `•••• ${plaintext.slice(-4)}`;
}
