// Web Crypto API End-to-End Encryption Engine (ECDH P-256 + AES-GCM 256)

// Helpers for Base64 <-> ArrayBuffer
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Key Storage in LocalStorage / Memory
const PRIVATE_KEY_STORAGE_PREFIX = 'wa_e2ee_priv_key_';
const PUBLIC_KEY_STORAGE_PREFIX = 'wa_e2ee_pub_key_';

// Cache for derived shared keys: `${myUserId}:${peerUserId}` -> CryptoKey
const sharedKeyCache = new Map<string, CryptoKey>();

export class E2EEService {
  /**
   * Generates a new ECDH P-256 KeyPair
   */
  static async generateKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );
  }

  /**
   * Export key to JWK
   */
  static async exportJWK(key: CryptoKey): Promise<JsonWebKey> {
    return await window.crypto.subtle.exportKey('jwk', key);
  }

  /**
   * Import Public JWK
   */
  static async importPublicJWK(jwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
  }

  /**
   * Import Private JWK
   */
  static async importPrivateJWK(jwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );
  }

  /**
   * Store user keys locally
   */
  static saveKeysLocally(userId: string, privJwk: JsonWebKey, pubJwk: JsonWebKey) {
    try {
      localStorage.setItem(PRIVATE_KEY_STORAGE_PREFIX + userId, JSON.stringify(privJwk));
      localStorage.setItem(PUBLIC_KEY_STORAGE_PREFIX + userId, JSON.stringify(pubJwk));
    } catch (e) {
      console.error('Failed to store keys in localStorage:', e);
    }
  }

  /**
   * Load user keys from local storage or generate new if missing
   */
  static async getOrCreateUserKeys(userId: string): Promise<{
    keyPair: CryptoKeyPair;
    publicJwk: JsonWebKey;
  }> {
    const privSaved = localStorage.getItem(PRIVATE_KEY_STORAGE_PREFIX + userId);
    const pubSaved = localStorage.getItem(PUBLIC_KEY_STORAGE_PREFIX + userId);

    if (privSaved && pubSaved) {
      try {
        const privJwk = JSON.parse(privSaved);
        const pubJwk = JSON.parse(pubSaved);
        const privateKey = await this.importPrivateJWK(privJwk);
        const publicKey = await this.importPublicJWK(pubJwk);
        return {
          keyPair: { privateKey, publicKey },
          publicJwk: pubJwk,
        };
      } catch (e) {
        console.warn('Could not restore saved keys, generating fresh pair:', e);
      }
    }

    // Generate fresh keypair
    const keyPair = await this.generateKeyPair();
    const privJwk = await this.exportJWK(keyPair.privateKey);
    const pubJwk = await this.exportJWK(keyPair.publicKey);

    this.saveKeysLocally(userId, privJwk, pubJwk);

    return {
      keyPair,
      publicJwk: pubJwk,
    };
  }

  /**
   * Derives a symmetric AES-GCM 256-bit key from my private key and peer's public key (ECDH)
   */
  static async getSharedKey(
    myUserId: string,
    myPrivateKey: CryptoKey,
    peerUserId: string,
    peerPublicJwk: JsonWebKey
  ): Promise<CryptoKey> {
    const cacheKey = `${myUserId}:${peerUserId}`;
    if (sharedKeyCache.has(cacheKey)) {
      return sharedKeyCache.get(cacheKey)!;
    }

    const peerPublicKey = await this.importPublicJWK(peerPublicJwk);
    const sharedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: peerPublicKey,
      },
      myPrivateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true, // extractable for group sender keys
      ['encrypt', 'decrypt']
    );

    sharedKeyCache.set(cacheKey, sharedKey);
    return sharedKey;
  }

  /**
   * Encrypt Direct Message (Plaintext -> { ciphertext, iv })
   */
  static async encryptDirect(
    plaintext: string,
    sharedKey: CryptoKey
  ): Promise<{ ciphertext: string; iv: string }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(plaintext);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      sharedKey,
      encodedData
    );

    return {
      ciphertext: arrayBufferToBase64(encryptedBuffer),
      iv: arrayBufferToBase64(iv),
    };
  }

  /**
   * Decrypt Direct Message ({ ciphertext, iv } -> Plaintext)
   */
  static async decryptDirect(
    ciphertextB64: string,
    ivB64: string,
    sharedKey: CryptoKey
  ): Promise<string> {
    const ciphertext = base64ToArrayBuffer(ciphertextB64);
    const iv = base64ToArrayBuffer(ivB64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      sharedKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Encrypt Group Message with Sender-Key distribution
   * 1. Generate ephemeral 256-bit AES-GCM message key
   * 2. Encrypt plaintext with this message key
   * 3. Encrypt message key for each participant using their pairwise ECDH shared key
   */
  static async encryptGroup(
    plaintext: string,
    myUserId: string,
    myPrivateKey: CryptoKey,
    participants: { id: string; publicJwk?: JsonWebKey | null }[]
  ): Promise<{
    ciphertext: string;
    iv: string;
    encryptedKeys: Record<string, string>;
  }> {
    // 1. Generate random 256-bit AES-GCM message key
    const messageKey = await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );

    // 2. Encrypt message body
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedText = encoder.encode(plaintext);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      messageKey,
      encodedText
    );

    // 3. Export message key raw bytes
    const rawMessageKey = await window.crypto.subtle.exportKey('raw', messageKey);

    // 4. Encrypt message key for each participant
    const encryptedKeys: Record<string, string> = {};

    for (const p of participants) {
      if (!p.publicJwk) continue;
      try {
        const pairwiseKey = await this.getSharedKey(
          myUserId,
          myPrivateKey,
          p.id,
          p.publicJwk
        );

        const keyIv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedKeyBuf = await window.crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: keyIv,
          },
          pairwiseKey,
          rawMessageKey
        );

        // Package key IV + encrypted key bytes into base64
        const combined = new Uint8Array(keyIv.byteLength + encryptedKeyBuf.byteLength);
        combined.set(keyIv, 0);
        combined.set(new Uint8Array(encryptedKeyBuf), keyIv.byteLength);

        encryptedKeys[p.id] = arrayBufferToBase64(combined);
      } catch (err) {
        console.warn(`Failed to encrypt group key for participant ${p.id}:`, err);
      }
    }

    return {
      ciphertext: arrayBufferToBase64(ciphertextBuffer),
      iv: arrayBufferToBase64(iv),
      encryptedKeys,
    };
  }

  /**
   * Decrypt Group Message
   * 1. Decrypt participant's encrypted key using pairwise ECDH shared key with sender
   * 2. Re-import decrypted message key
   * 3. Decrypt ciphertext
   */
  static async decryptGroup(
    ciphertextB64: string,
    ivB64: string,
    encryptedKeys: Record<string, string>,
    myUserId: string,
    myPrivateKey: CryptoKey,
    senderId: string,
    senderPublicJwk: JsonWebKey
  ): Promise<string> {
    const encKeyPayloadB64 = encryptedKeys[myUserId];
    if (!encKeyPayloadB64) {
      throw new Error('No encrypted key found for current user in group message');
    }

    const pairwiseKey = await this.getSharedKey(
      myUserId,
      myPrivateKey,
      senderId,
      senderPublicJwk
    );

    const combinedBytes = new Uint8Array(base64ToArrayBuffer(encKeyPayloadB64));
    const keyIv = combinedBytes.slice(0, 12);
    const encKeyBytes = combinedBytes.slice(12);

    const rawMessageKey = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: keyIv,
      },
      pairwiseKey,
      encKeyBytes
    );

    const messageKey = await window.crypto.subtle.importKey(
      'raw',
      rawMessageKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    const ciphertext = base64ToArrayBuffer(ciphertextB64);
    const iv = base64ToArrayBuffer(ivB64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      messageKey,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  /**
   * Generate WhatsApp 60-digit Safety Number & Fingerprint
   * Grouped into 12 blocks of 5 digits (e.g., 29103 48192 ...)
   */
  static async generateSafetyNumber(
    pubKeyA: JsonWebKey,
    pubKeyB: JsonWebKey
  ): Promise<{
    safetyNumber: string;
    formattedBlocks: string[];
    qrData: string;
  }> {
    // Sort keys deterministically
    const strA = `${pubKeyA.x}:${pubKeyA.y}`;
    const strB = `${pubKeyB.x}:${pubKeyB.y}`;
    const combined = strA < strB ? strA + '|' + strB : strB + '|' + strA;

    const encoder = new TextEncoder();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(combined));
    const hashBytes = new Uint8Array(hashBuffer);

    // Convert bytes into 60 numeric digits
    let digits = '';
    for (let i = 0; i < hashBytes.length && digits.length < 60; i++) {
      const num = hashBytes[i] % 10;
      digits += num.toString();
      // Use next 4 bits too
      const num2 = (hashBytes[i] >> 4) % 10;
      digits += num2.toString();
    }

    // Pad if needed
    while (digits.length < 60) {
      digits += (digits.length % 10).toString();
    }
    digits = digits.substring(0, 60);

    const blocks: string[] = [];
    for (let i = 0; i < 60; i += 5) {
      blocks.push(digits.substring(i, i + 5));
    }

    return {
      safetyNumber: blocks.join(' '),
      formattedBlocks: blocks,
      qrData: `whatsapp-e2ee://verify?v=1&num=${digits}`,
    };
  }
}
