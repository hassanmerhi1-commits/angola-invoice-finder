/**
 * RSA-SHA256 Digital Signing Service for AGT Compliance
 * Uses Node.js crypto module for local signing
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Keys directory
const KEYS_DIR = path.join(process.env.APPDATA || process.env.HOME, '.kwanzaerp', 'keys');

/**
 * Ensure keys directory exists
 */
function ensureKeysDirectory() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Generate new RSA-2048 key pair
 * @param {string} keyAlias - Unique identifier for the key
 * @param {string} passphrase - Encryption passphrase for private key
 * @returns {{ publicKey: string, privateKeyPath: string }}
 */
function generateKeyPair(keyAlias, passphrase) {
  ensureKeysDirectory();

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase: passphrase
    }
  });

  // Save private key encrypted
  const privateKeyPath = path.join(KEYS_DIR, `${keyAlias}.key.enc`);
  fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });

  // Save public key
  const publicKeyPath = path.join(KEYS_DIR, `${keyAlias}.pub.pem`);
  fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

  // Calculate hash of encrypted private key for verification
  const privateKeyHash = crypto.createHash('sha256').update(privateKey).digest('hex');

  console.log(`[RSA] Generated new key pair: ${keyAlias}`);

  return {
    publicKey,
    publicKeyPath,
    privateKeyPath,
    privateKeyHash
  };
}

/**
 * Load private key from encrypted file
 * @param {string} keyAlias - Key identifier
 * @param {string} passphrase - Decryption passphrase
 * @returns {crypto.KeyObject}
 */
function loadPrivateKey(keyAlias, passphrase) {
  const privateKeyPath = path.join(KEYS_DIR, `${keyAlias}.key.enc`);
  
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Private key not found: ${keyAlias}`);
  }

  const encryptedKey = fs.readFileSync(privateKeyPath, 'utf8');
  
  return crypto.createPrivateKey({
    key: encryptedKey,
    passphrase: passphrase
  });
}

/**
 * Load public key
 * @param {string} keyAlias - Key identifier
 * @returns {string} PEM encoded public key
 */
function loadPublicKey(keyAlias) {
  const publicKeyPath = path.join(KEYS_DIR, `${keyAlias}.pub.pem`);
  
  if (!fs.existsSync(publicKeyPath)) {
    throw new Error(`Public key not found: ${keyAlias}`);
  }

  return fs.readFileSync(publicKeyPath, 'utf8');
}

/**
 * Sign invoice data using RSA-SHA256
 * @param {Object} invoiceData - Invoice data to sign
 * @param {string} keyAlias - Key to use for signing
 * @param {string} passphrase - Key passphrase
 * @returns {{ signature: string, hash: string, shortHash: string }}
 */
function signInvoice(invoiceData, keyAlias, passphrase) {
  // Build canonical string to sign (AGT format)
  const canonicalString = buildCanonicalSigningString(invoiceData);
  
  // Calculate SHA-256 hash of content
  const contentHash = crypto.createHash('sha256').update(canonicalString).digest('hex');
  
  // Load private key and sign
  const privateKey = loadPrivateKey(keyAlias, passphrase);
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(canonicalString);
  sign.end();
  
  const signature = sign.sign(privateKey, 'base64');
  
  // Short hash for QR code (first 4 characters)
  const shortHash = contentHash.substring(0, 4).toUpperCase();
  
  console.log(`[RSA] Signed invoice: ${invoiceData.invoiceNumber}`);

  return {
    signature,
    hash: contentHash,
    shortHash,
    algorithm: 'RSA-SHA256'
  };
}

/**
 * Build canonical string for signing according to AGT specs
 * Format: Date;SystemEntryDate;InvoiceNumber;GrossTotal;PreviousHash
 * @param {Object} data - Invoice data
 * @returns {string}
 */
function buildCanonicalSigningString(data) {
  const parts = [
    data.date || new Date().toISOString().split('T')[0],
    data.systemEntryDate || new Date().toISOString(),
    data.invoiceNumber,
    (data.grossTotal || data.total || 0).toFixed(2),
    data.previousHash || '0'
  ];
  
  return parts.join(';');
}

/**
 * Verify signature
 * @param {Object} invoiceData - Original invoice data
 * @param {string} signature - Base64 encoded signature
 * @param {string} keyAlias - Key used for signing
 * @returns {boolean}
 */
function verifySignature(invoiceData, signature, keyAlias) {
  const canonicalString = buildCanonicalSigningString(invoiceData);
  const publicKey = loadPublicKey(keyAlias);
  
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(canonicalString);
  verify.end();
  
  return verify.verify(publicKey, signature, 'base64');
}

/**
 * Calculate SHA-256 hash
 * @param {string} data - Data to hash
 * @returns {string} Hex encoded hash
 */
function calculateHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate hash for chaining (audit log)
 * @param {string} previousHash - Previous row hash
 * @param {Object} rowData - Current row data
 * @returns {string}
 */
function generateChainedHash(previousHash, rowData) {
  const dataString = JSON.stringify(rowData) + previousHash;
  return calculateHash(dataString);
}

/**
 * List available signing keys
 * @returns {string[]}
 */
function listKeys() {
  ensureKeysDirectory();
  
  return fs.readdirSync(KEYS_DIR)
    .filter(f => f.endsWith('.pub.pem'))
    .map(f => f.replace('.pub.pem', ''));
}

/**
 * Check if key exists
 * @param {string} keyAlias 
 * @returns {boolean}
 */
function keyExists(keyAlias) {
  const publicKeyPath = path.join(KEYS_DIR, `${keyAlias}.pub.pem`);
  const privateKeyPath = path.join(KEYS_DIR, `${keyAlias}.key.enc`);
  return fs.existsSync(publicKeyPath) && fs.existsSync(privateKeyPath);
}

module.exports = {
  generateKeyPair,
  loadPrivateKey,
  loadPublicKey,
  signInvoice,
  verifySignature,
  calculateHash,
  generateChainedHash,
  listKeys,
  keyExists,
  KEYS_DIR
};
