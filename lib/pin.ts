import { getSettings, resetSettingsCache } from './settings'

const SESSION_KEY = 'rs_pin_unlocked_at'
const SESSION_TTL_MS = 1000 * 60 * 60 * 4 // 4 horas

/**
 * Devuelve true si la sesión actual ya tiene el PIN desbloqueado (y no expiró).
 */
export function isPinUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts) || Date.now() - ts > SESSION_TTL_MS) {
      sessionStorage.removeItem(SESSION_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Marca la sesión como desbloqueada (guarda timestamp actual).
 */
export function markPinUnlocked(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_KEY, String(Date.now()))
  } catch {
    /* noop */
  }
}

/**
 * Bloquea la sesión (por ejemplo, al cerrar sesión).
 */
export function lockPinSession(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* noop */
  }
}

/**
 * Verifica un PIN contra el configurado en Ajustes.
 * - Si no hay PIN configurado, siempre devuelve true (sin protección).
 * - Si hay PIN, compara el valor ingresado.
 */
export async function verifyPin(input: string): Promise<boolean> {
  // Refresca settings desde Supabase para tener el valor más reciente
  resetSettingsCache()
  const settings = await getSettings()

  const configured = (settings.adminPin || '').trim()
  if (!configured) return true // sin protección → acceso libre

  return input.trim() === configured
}

/**
 * Indica si hay un PIN configurado (para mostrar/ocultar la puerta).
 */
export async function isPinConfigured(): Promise<boolean> {
  const settings = await getSettings()
  return Boolean((settings.adminPin || '').trim())
}
