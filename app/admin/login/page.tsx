'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Mail, Loader2, AlertTriangle } from 'lucide-react'
import { createAuthClient } from '@/lib/supabase/auth-client'
import { getUserProfile, roleHome } from '@/lib/auth'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const supabase = createAuthClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const profile = await getUserProfile(user.email)
      router.replace(roleHome(profile?.role ?? 'advisor'))
    })
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const supabase = createAuthClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setErrorMessage(
          error.message === 'Invalid login credentials'
            ? 'Correo o contraseña incorrectos.'
            : error.message
        )
        return
      }

      if (!data.session) {
        setErrorMessage('No se pudo iniciar sesión. Intenta de nuevo.')
        return
      }

      // Redirigir según rol (admin → /admin, asesor → /advisor)
      const profile = await getUserProfile(data.user?.email)
      const home = roleHome(profile?.role ?? 'advisor')
      const next = searchParams.get('next')
      router.replace(next && next.startsWith(home) ? next : home)
      router.refresh()
    } catch (error: any) {
      setErrorMessage(`Error inesperado: ${error?.message || 'desconocido'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="ds-root ds-anim-in flex min-h-screen items-center justify-center p-4">
      {/* Glows */}
      <div className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-[#ef4444]/[0.07] blur-[130px]" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#dc2626]/[0.06] blur-[140px]" />

      <div className="ds-card ds-anim-in relative w-full max-w-md rounded-[24px] p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-[#ef4444]/30 bg-gradient-to-br from-[#ef4444] to-[#dc2626] text-2xl font-black text-white shadow-lg shadow-[#ef4444]/25">
            R
          </div>
          <h1 className="ds-text-gold text-2xl tracking-tight">Reality Shop</h1>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ds-txt-3)' }}>
            Ingresa tus credenciales de acceso
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="ds-eyebrow mb-2 block">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 size-4" style={{ color: 'var(--ds-txt-3)' }} />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tuemail@reality.com"
                className="ds-input ds-input-icon"
              />
            </div>
          </div>

          <div>
            <label className="ds-eyebrow mb-2 block">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 size-4" style={{ color: 'var(--ds-txt-3)' }} />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="ds-input ds-input-icon"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-[#ff453a]/40 bg-[#ff453a]/10 p-3 text-xs font-semibold text-[#ff6b6b]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="ds-btn-gold mt-6 w-full py-4 text-xs uppercase tracking-widest"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Iniciando sesión...
              </span>
            ) : (
              'Ingresar al Panel'
            )}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="ds-root flex min-h-screen items-center justify-center">
          <Loader2 className="size-6 animate-spin text-[#ef4444]" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
