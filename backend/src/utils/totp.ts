import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

const leftPad = (value: string, length: number) => value.padStart(length, "0");

const base32Encode = (buffer: Buffer) => {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const base32Decode = (secret: string) => {
  const normalized = secret.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);

    if (index === -1) {
      throw new Error("Invalid TOTP secret");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

const generateHotp = (secret: string, counter: number) => {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return leftPad(String(code % 10 ** TOTP_DIGITS), TOTP_DIGITS);
};

export const generateTotpSecret = () => base32Encode(crypto.randomBytes(20));

export const verifyTotpCode = (
  secret: string,
  code: string,
  options?: {
    window?: number;
    now?: number;
  }
) => {
  const normalizedCode = code.trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const now = options?.now ?? Date.now();
  const window = options?.window ?? 1;
  const currentCounter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);

  for (let offset = -window; offset <= window; offset += 1) {
    if (generateHotp(secret, currentCounter + offset) === normalizedCode) {
      return true;
    }
  }

  return false;
};

export const buildOtpAuthUri = (email: string, secret: string, issuer = "Training Tracker") => {
  const label = `${issuer}:${email}`;

  return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
};
