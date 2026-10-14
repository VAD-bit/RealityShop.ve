'use client'

import { useState } from 'react'
import { X, Loader2, Mail, Lock, User, Phone, LogIn, UserPlus } from 'lucide-react'
import { useCustomer } from '@/lib/customer-context'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  title?: string
  subtitle?: string
}

export function AuthModal({ isOpen, onClose, onSuccess, title, subtitle }: AuthModalProps) {
  const { login, register } = useCustomer()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await login(email, password)
        if (error) {
          setError(error)
          return
        }
      } else {
        if (!name.trim() || !phone.trim()) {
          setError('Nombre y teléfono son obligatorios.')
          return
        }
        const { error } = await register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password })
        if (error) {
          setError(error)
          return
        }
      }
      onSuccess?.()
      onClose()
      // Reset
      setName('')
      setEmail('')
      setPhone('')
      setPassword('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-heading text-lg font-black uppercase tracking-wider text-white">
              {title || (mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta')}
            </h3>
            {subtitle && (
              <p className="mt-1 text-xs text-neutral-400">{subtitle}</p>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-400 transition hover:text-white" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-1">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null) }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition ${
              mode === 'login' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <LogIn className="size-3.5" />
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null) }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition ${
              mode === 'register' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <UserPlus className="size-3.5" />
            Registrarme
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Nombre completo *
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-3 pl-10 pr-4 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-red-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Correo electrónico *
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@gmail.com"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-3 pl-10 pr-4 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-red-500"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
                WhatsApp *
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0412-0000000"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-3 pl-10 pr-4 font-mono text-sm text-white placeholder-neutral-600 outline-none transition focus:border-red-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Contraseña *
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-3 pl-10 pr-4 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-red-500"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 font-heading text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {mode === 'login' ? 'Entrando...' : 'Creando cuenta...'}
              </>
            ) : mode === 'login' ? (
              'Iniciar sesión'
            ) : (
              'Crear mi cuenta'
            )}
          </button>
        </form>

        {mode === 'register' && (
          <p className="mt-4 text-center text-[11px] text-neutral-500">
            Al registrarte aceptas recibir notificaciones de ofertas y novedades.
          </p>
        )}
      </div>
    </div>
  )
}
