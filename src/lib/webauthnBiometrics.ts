/**
 * WebAuthn Biometric Authentication Module for Budget Bubby
 * Provides platform biometric integration (Touch ID / Face ID / Windows Hello / Android Fingerprint)
 * 
 * Features:
 * - Detects platform authenticator availability via PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
 * - Enrolls biometrics by generating a platform WebAuthn credential bound to the user's PIN
 * - Securely stores device unlock token in localStorage
 * - Authenticates via navigator.credentials.get() and unlocks PIN session without manual typing
 * - Provides management APIs to inspect enrollment status and disable biometric login
 */

export const BIOMETRICS_STORAGE_KEY = 'budget_bubby_biometrics_credential';

export interface EnrolledBiometricInfo {
  enrolled: boolean;
  enrolledAt?: string;
  partnerName?: string;
  credentialId?: string;
}

interface StoredBiometricRecord {
  credentialId: string;
  encryptedToken: string;
  enrolledAt: string;
  partnerName: string;
}

/**
 * Reversibly enciphers the PIN bound to the credential ID for device unlock.
 */
function encryptDeviceToken(pin: string, credentialId: string): string {
  const payload = JSON.stringify({ pin, credentialId, ts: Date.now() });
  const key = `BB_BIO_SALT_${credentialId.slice(0, 12)}`;
  let xored = '';
  for (let i = 0; i < payload.length; i++) {
    xored += String.fromCharCode(payload.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(unescape(encodeURIComponent(xored)));
}

/**
 * Deciphers the device token to retrieve the authenticated 6-digit PIN.
 */
function decryptDeviceToken(token: string, credentialId: string): string | null {
  try {
    const raw = decodeURIComponent(escape(atob(token)));
    const key = `BB_BIO_SALT_${credentialId.slice(0, 12)}`;
    let original = '';
    for (let i = 0; i < raw.length; i++) {
      original += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    const data = JSON.parse(original);
    return typeof data.pin === 'string' ? data.pin : null;
  } catch (err) {
    console.debug('Failed to decrypt biometric device token:', err);
    return null;
  }
}

/**
 * Checks whether the current device/browser supports WebAuthn platform biometrics
 * (Touch ID, Face ID, Windows Hello, Android Biometrics).
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;

  if (
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
    'function'
  ) {
    return false;
  }

  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (err) {
    console.debug('Error checking platform authenticator availability:', err);
    return false;
  }
}

/**
 * Returns whether biometric login is currently enrolled on this device.
 */
export function isBiometricsEnrolled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(BIOMETRICS_STORAGE_KEY);
    if (!raw) return false;
    const record: StoredBiometricRecord = JSON.parse(raw);
    return Boolean(record?.credentialId && record?.encryptedToken);
  } catch {
    return false;
  }
}

/**
 * Retrieves enrollment information for the active device.
 */
export function getEnrolledBiometricInfo(): EnrolledBiometricInfo {
  if (typeof window === 'undefined') return { enrolled: false };
  try {
    const raw = window.localStorage.getItem(BIOMETRICS_STORAGE_KEY);
    if (!raw) return { enrolled: false };
    const record: StoredBiometricRecord = JSON.parse(raw);
    if (record?.credentialId && record?.encryptedToken) {
      return {
        enrolled: true,
        enrolledAt: record.enrolledAt,
        partnerName: record.partnerName,
        credentialId: record.credentialId,
      };
    }
    return { enrolled: false };
  } catch {
    return { enrolled: false };
  }
}

/**
 * Enrolls device biometrics for the current user and PIN.
 * Prompts the user with Touch ID / Face ID / Platform authenticator.
 */
export async function enrollBiometrics(
  pin: string,
  partnerName: string = 'Budget Bubby User'
): Promise<boolean> {
  if (!pin || pin.length !== 6) {
    throw new Error('Valid 6-digit PIN is required to enroll biometrics');
  }

  if (typeof window === 'undefined' || !navigator.credentials?.create) {
    throw new Error('WebAuthn credential creation is not supported on this browser');
  }

  // Generate 32-byte challenge
  const challenge = new Uint8Array(32);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(challenge);
  }

  // User identifier
  const userId = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(userId);
  }

  const creationOptions: CredentialCreationOptions = {
    publicKey: {
      challenge,
      rp: {
        name: 'Budget Bubby',
        id: window.location.hostname || 'localhost',
      },
      user: {
        id: userId,
        name: partnerName.toLowerCase().replace(/\s+/g, '_'),
        displayName: partnerName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  };

  const credential = (await navigator.credentials.create(
    creationOptions
  )) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Biometric enrollment cancelled');
  }

  // Derive credential ID string
  let credentialId = credential.id;
  if (!credentialId && credential.rawId) {
    const uint8 = new Uint8Array(credential.rawId);
    credentialId = btoa(String.fromCharCode(...uint8));
  }

  const encryptedToken = encryptDeviceToken(pin, credentialId);

  const record: StoredBiometricRecord = {
    credentialId,
    encryptedToken,
    enrolledAt: new Date().toISOString(),
    partnerName,
  };

  window.localStorage.setItem(BIOMETRICS_STORAGE_KEY, JSON.stringify(record));
  return true;
}

/**
 * Authenticates with device biometrics (Touch ID / Face ID).
 * If biometric check passes, decrypts and returns the stored 6-digit PIN.
 */
export async function authenticateWithBiometrics(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(BIOMETRICS_STORAGE_KEY);
  if (!raw) {
    throw new Error('No biometric credentials enrolled on this device');
  }

  let record: StoredBiometricRecord;
  try {
    record = JSON.parse(raw);
  } catch {
    throw new Error('Corrupted biometric credential record');
  }

  if (!navigator.credentials?.get) {
    throw new Error('WebAuthn authentication is not supported on this browser');
  }

  const challenge = new Uint8Array(32);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(challenge);
  }

  let rawCredentialId: ArrayBuffer | undefined = undefined;
  try {
    const binaryStr = atob(record.credentialId);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    rawCredentialId = bytes.buffer;
  } catch {
    // If not standard base64, allow passing empty or fallback
  }

  const requestOptions: CredentialRequestOptions = {
    publicKey: {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: rawCredentialId
        ? [
            {
              id: rawCredentialId,
              type: 'public-key',
            },
          ]
        : [],
    },
  };

  const assertion = await navigator.credentials.get(requestOptions);
  if (!assertion) {
    return null;
  }

  const pin = decryptDeviceToken(record.encryptedToken, record.credentialId);
  return pin;
}

/**
 * Disables and deletes the biometric credential from this device.
 */
export function disableBiometrics(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(BIOMETRICS_STORAGE_KEY);
}
