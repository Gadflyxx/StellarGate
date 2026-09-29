// Session helpers for the dashboard.
//
// These implement the API key storage/expiry rules from #252. The key is kept
// in memory only and is never written to a URL, a log line or the console.

// How long a stored key stays valid, in milliseconds.
const KEY_TTL_MS = 30 * 60 * 1000;

// In-memory storage for the API key. Deliberately not persisted anywhere so
// the key can never leak through URLs, logs or console output.
let storedKey = null;
let storedKeyExpiresAt = 0;

// Returns the currently stored API key, or null when there is none or the
// stored key has expired. Expired keys are dropped on read.
export function getStoredKey() {
  if (storedKey === null) {
    return null;
  }
  if (Date.now() >= storedKeyExpiresAt) {
    forgetKey();
    return null;
  }
  return storedKey;
}

// Stores an API key with the standard expiry window.
export function storeKey(key) {
  storedKey = key;
  storedKeyExpiresAt = Date.now() + KEY_TTL_MS;
}

// Clears any stored API key and its expiry.
export function forgetKey() {
  storedKey = null;
  storedKeyExpiresAt = 0;
}
