import CryptoJS from "crypto-js";

const LEGACY_PROTOCOL = 'legacy';
const AEAD_PROTOCOL = 'aead';
const AEAD_AD = new TextEncoder().encode('chonglangban:v2:path');

const getConfig = () => (
  typeof window !== 'undefined' && window.CHONGLANGBAN_CONFIG
    ? window.CHONGLANGBAN_CONFIG
    : {}
);

export const getMiddlewareProtocol = () => {
  const configured = String(getConfig().API_MIDDLEWARE_PROTOCOL || LEGACY_PROTOCOL).toLowerCase();
  return configured === AEAD_PROTOCOL ? AEAD_PROTOCOL : LEGACY_PROTOCOL;
};

export const isAeadMiddlewareEnabled = () => (
  getMiddlewareProtocol() === AEAD_PROTOCOL && /^[0-9a-f]{64}$/i.test(String(getConfig().API_MIDDLEWARE_AEAD_KEY || ''))
);

// 获取或生成 v1 兼容协议的 IV。
export const randomIv = () => {
  const saveIv = localStorage.getItem('temp_iv');
  if (saveIv && /^[0-9a-f]{16}$/i.test(saveIv)) {
    return saveIv;
  }

  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  localStorage.setItem('temp_iv', hex);
  return hex;
};

// v1：与 EZ 完全兼容的 AES-CBC/PKCS7。
export function Encrypt(data, k, i) {
  try {
    const key = CryptoJS.enc.Utf8.parse(k);
    const iv = CryptoJS.enc.Utf8.parse(i);
    const srcs = CryptoJS.enc.Utf8.parse(data);
    const encrypted = CryptoJS.AES.encrypt(srcs, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.toString();
  } catch (error) {
    console.error('legacy encryption failed:', error);
    return '';
  }
}

export function Decrypt(data, k, i) {
  try {
    const key = CryptoJS.enc.Utf8.parse(k);
    const iv = CryptoJS.enc.Utf8.parse(i);
    const decrypt = CryptoJS.AES.decrypt(data, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return decrypt.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('legacy decryption failed:', error);
    return '';
  }
}

export const getEncrypUrl = (url) => {
  const iv = randomIv();
  return Encrypt(url, getConfig().API_MIDDLEWARE_KEY || '', iv);
};

const hexToBytes = (value) => {
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error('API_MIDDLEWARE_AEAD_KEY must be 64 hexadecimal characters');
  }
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const toBase64Url = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

// v2：AES-256-GCM，nonce 内置于 URL，服务端无需 X-IV。
export async function EncryptAEAD(data, keyHex = getConfig().API_MIDDLEWARE_AEAD_KEY || '') {
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前浏览器不支持 Web Crypto API');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBytes(keyHex),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(data);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: AEAD_AD, tagLength: 128 },
    key,
    plaintext
  ));
  const payload = new Uint8Array(nonce.length + ciphertext.length);
  payload.set(nonce, 0);
  payload.set(ciphertext, nonce.length);
  return `v2.${toBase64Url(payload)}`;
}

// 根据当前配置生成中间件 URL 的最后一段；可用于 API 和加密订阅链接。
export async function getEncryptedPath(path) {
  if (getMiddlewareProtocol() === AEAD_PROTOCOL) {
    return EncryptAEAD(path);
  }
  return btoa(getEncrypUrl(path));
}

// 将 V2Board 返回的明文订阅地址转换为中间件 v2 加密订阅地址。
// v1 保持原始链接，避免影响旧客户端和旧服务端。
export async function getProtectedSubscriptionUrl(rawUrl) {
  if (getMiddlewareProtocol() !== AEAD_PROTOCOL || !rawUrl) {
    return rawUrl;
  }
  const config = getConfig();
  const parsed = new URL(rawUrl, window.location.origin);
  const middlewareUrl = String(config.API_MIDDLEWARE_URL || '').replace(/\/+$/g, '');
  const middlewarePath = String(config.API_MIDDLEWARE_PATH || '').replace(/^\/+|\/+$/g, '');
  if (!middlewareUrl || !middlewarePath) {
    throw new Error('AES-GCM 订阅链接缺少中间件地址或路径配置');
  }
  const logicalPath = `${parsed.pathname}${parsed.search}`;
  const encryptedPath = await getEncryptedPath(logicalPath);
  return `${middlewareUrl}/${middlewarePath}/${encodeURIComponent(encryptedPath)}`;
}
