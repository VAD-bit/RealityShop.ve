import { createClient } from './supabase/client'

export type UserRole = 'admin' | 'advisor'

export interface UserProfile {
  email: string
  role: UserRole
  advisor_name: string | null
}

/**
 * Perfiles conocidos (fallback si la tabla user_profiles no existe aún).
 */
const FALLBACK_PROFILES: Record<string, UserProfile> = {
  'administrador@reality.com': {
    email: 'administrador@reality.com',
    role: 'admin',
    advisor_name: null,
  },
  'victor@reality.com': { email: 'victor@reality.com', role: 'advisor', advisor_name: 'Victor Diaz' },
  'jeff@reality.com': { email: 'jeff@reality.com', role: 'advisor', advisor_name: 'Jeff Carrero' },
  'angel@reality.com': { email: 'angel@reality.com', role: 'advisor', advisor_name: 'Angel Serrano' },
}

/**
 * Home según rol.
 */
export function roleHome(role: UserRole): string {
  return role === 'advisor' ? '/advisor' : '/admin'
}

/**
 * Resuelve el perfil (rol) de un usuario a partir de su email.
 * Consulta user_profiles; si falla usa el fallback conocido.
 * Si no hay perfil → rol restringido 'advisor' (panel vacío, sin acceso admin).
 */
export async function getUserProfile(
  email: string | null | undefined
): Promise<UserProfile | null> {
  if (!email) return null
  const key = email.trim().toLowerCase()

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('email, role, advisor_name')
      .eq('email', key)
      .single()

    if (!error && data) {
      return data as UserProfile
    }
  } catch {
    /* tabla no existe aún → fallback */
  }

  return FALLBACK_PROFILES[key] || null
}

/**
 * Rol por defecto para usuarios sin perfil: restringido.
 */
export function resolveRole(profile: UserProfile | null): UserRole {
  return profile?.role ?? 'advisor'
}
