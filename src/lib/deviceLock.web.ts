/*
 * The website's app lock: the device's own check that it's you (Windows Hello, Touch ID or Face ID, Android's fingerprint or screen lock),
 * through the browser's passkey support (WebAuthn). The first time, the device makes a key for 4D Ages on this browser; after that, unlocking
 * asks the device to confirm it's you with that key. Nothing leaves the device: it's only a check, not a sign-in.
 */
const KEY = "4d-lock-key";
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const toB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function canLock(): Promise<boolean> {
  try {
    return typeof PublicKeyCredential !== "undefined" && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export async function unlock(_reason: string): Promise<boolean> {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) {
      // the first time: the device makes a key for 4D Ages (asking for the fingerprint, face or PIN to do it)
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: random(32),
          rp: { name: "4D Ages", id: location.hostname },
          user: { id: random(16), name: "4D Ages", displayName: "4D Ages lock" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;
      if (!cred) return false;
      localStorage.setItem(KEY, toB64(cred.rawId));
      return true;
    }
    const got = await navigator.credentials.get({
      publicKey: { challenge: random(32), allowCredentials: [{ type: "public-key", id: fromB64(saved) }], userVerification: "required", timeout: 60000, rpId: location.hostname },
    });
    return !!got;
  } catch {
    return false;
  }
}
