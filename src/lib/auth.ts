// Authentication utilities with enhanced security features

const CORRECT_PASSCODE = "Mangotaxpos@river.88"
const PASSCODE_VERSION = "v3_Mangotaxpos@river.88" // Change this whenever passcode changes
const MAX_ATTEMPTS = 3
const LOCKOUT_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds
const INACTIVITY_TIMEOUT = 10 * 60 * 1000 // 10 minutes in milliseconds
const SESSION_KEY = "tax_system_session"
const PASSCODE_VERSION_KEY = "tax_system_passcode_version"
const DEVICE_KEY = "tax_system_device"
const ATTEMPTS_KEY = "tax_system_attempts"
const LOCKOUT_KEY = "tax_system_lockout"
const LAST_ACTIVITY_KEY = "tax_system_last_activity"

// Device fingerprinting
export function generateDeviceFingerprint(): string {
  if (typeof window === "undefined") return ""

  const userAgent = navigator.userAgent
  const platform = navigator.platform
  const language = navigator.language
  const screenResolution = `${window.screen.width}x${window.screen.height}`
  const colorDepth = window.screen.colorDepth
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const fingerprint = `${userAgent}|${platform}|${language}|${screenResolution}|${colorDepth}|${timezone}`

  // Create a simple hash
  let hash = 0
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }

  return `device_${Math.abs(hash).toString(36)}`
}

export function getStoredDeviceFingerprint(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(DEVICE_KEY)
}

export function storeDeviceFingerprint(fingerprint: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(DEVICE_KEY, fingerprint)
}

export function isRecognizedDevice(): boolean {
  const currentFingerprint = generateDeviceFingerprint()
  const storedFingerprint = getStoredDeviceFingerprint()
  return storedFingerprint === currentFingerprint
}

// Session management
export function generateSessionToken(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2)
  return `session_${timestamp}_${random}`
}

export function createSession(): void {
  if (typeof window === "undefined") return
  const token = generateSessionToken()
  sessionStorage.setItem(SESSION_KEY, token)
  sessionStorage.setItem(PASSCODE_VERSION_KEY, PASSCODE_VERSION)
  updateLastActivity()
}

export function getSession(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(SESSION_KEY)
}

export function isSessionPasscodeValid(): boolean {
  if (typeof window === "undefined") return false
  const storedVersion = sessionStorage.getItem(PASSCODE_VERSION_KEY)
  return storedVersion === PASSCODE_VERSION
}

export function destroySession(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(PASSCODE_VERSION_KEY)
  localStorage.removeItem(LAST_ACTIVITY_KEY)
}

export function isSessionValid(): boolean {
  return getSession() !== null
}

// Attempt tracking and lockout
export function getFailedAttempts(): number {
  if (typeof window === "undefined") return 0
  const attempts = localStorage.getItem(ATTEMPTS_KEY)
  return attempts ? Number.parseInt(attempts, 10) : 0
}

export function incrementFailedAttempts(): number {
  if (typeof window === "undefined") return 0
  const attempts = getFailedAttempts() + 1
  localStorage.setItem(ATTEMPTS_KEY, attempts.toString())
  return attempts
}

export function resetFailedAttempts(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(ATTEMPTS_KEY)
}

export function setLockout(): void {
  if (typeof window === "undefined") return
  const lockoutUntil = Date.now() + LOCKOUT_DURATION
  localStorage.setItem(LOCKOUT_KEY, lockoutUntil.toString())
}

export function isLockedOut(): boolean {
  if (typeof window === "undefined") return false
  const lockoutUntil = localStorage.getItem(LOCKOUT_KEY)
  if (!lockoutUntil) return false

  const now = Date.now()
  const lockoutTime = Number.parseInt(lockoutUntil, 10)

  if (now < lockoutTime) {
    return true
  } else {
    // Lockout expired, clear it
    clearLockout()
    return false
  }
}

export function clearLockout(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(LOCKOUT_KEY)
  resetFailedAttempts()
}

export function getRemainingLockoutTime(): number {
  if (typeof window === "undefined") return 0
  const lockoutUntil = localStorage.getItem(LOCKOUT_KEY)
  if (!lockoutUntil) return 0

  const now = Date.now()
  const lockoutTime = Number.parseInt(lockoutUntil, 10)
  const remaining = lockoutTime - now

  return remaining > 0 ? remaining : 0
}

// Inactivity detection
export function updateLastActivity(): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
}

export function getLastActivity(): number {
  if (typeof window === "undefined") return Date.now()
  const lastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY)
  return lastActivity ? Number.parseInt(lastActivity, 10) : Date.now()
}

export function isInactive(): boolean {
  const lastActivity = getLastActivity()
  const now = Date.now()
  return now - lastActivity > INACTIVITY_TIMEOUT
}

// Authentication
export function verifyPasscode(passcode: string): boolean {
  return passcode === CORRECT_PASSCODE
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false

  // Check if session exists and is valid
  if (!isSessionValid()) return false

  // Check if session has correct passcode version (invalidates old sessions)
  if (!isSessionPasscodeValid()) {
    console.log("[v0] Session invalidated due to passcode change")
    logout()
    return false
  }

  // Check if user is inactive
  if (isInactive()) {
    logout()
    return false
  }

  // Update last activity
  updateLastActivity()

  return true
}

export function logout(): void {
  destroySession()
}

export function fullLogout(): void {
  logout()
  // Optionally clear device fingerprint on full logout
  // localStorage.removeItem(DEVICE_KEY)
}

// Wrapper functions for compatibility
export function validatePasscode(passcode: string): { success: boolean; error?: string; locked?: boolean } {
  if (isLockedOut()) {
    return { success: false, error: "Device is locked", locked: true };
  }

  if (verifyPasscode(passcode)) {
    resetFailedAttempts();
    return { success: true };
  }

  const attempts = incrementFailedAttempts();
  if (attempts >= MAX_ATTEMPTS) {
    setLockout();
    return { success: false, error: "Too many attempts. Device locked.", locked: true };
  }

  return { success: false, error: `Invalid passcode. ${MAX_ATTEMPTS - attempts} attempts remaining.` };
}

export function clearSession(): void {
  logout();
}

export function checkInactivity(): boolean {
  return isInactive();
}

export function isDeviceLocked(): boolean {
  return isLockedOut();
}
