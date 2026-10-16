'use client'

import { useEffect, useState, useCallback } from 'react'
import { Lock, Eye, EyeOff, ShieldAlert, Loader2 } from 'lucide-react'
import { getSettings } from '@/lib/settings'
import { isPinUnlocked, markPinUnlocked, verifyPin } from '@/lib/pin'

interface PinGateProps {
  children: React.ReactNode
  /** Nombre corto que se muestra en el modal (ej: "Inventario") */
  sectionName?: string
}

/**
 * Envuelve el contenido de una sección protegida con un PIN.
 * - Si no hay PIN configurado, muestra el contenido directo.
 * - Si hay PIN y la sesión no está desbloqueada, muestra el modal de ingreso.
 * - Tras ingresar el PIN correcto, la sesión queda desbloqueada por 4 horas.
 */
export function PinGate({ children, sectionName = 'esta sección' }: PinGateProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [needsPin, setNeedsPin] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const settings = await getSettings()
        const configured = Boolean((settings.adminPin || '').trim())
        if (cancelled) return

        if (!configured) {
          setNeedsPin(false)
          setIsUnlocked(true)
        } else if (isPinUnlocked()) {
          setNeedsPin(true)
          setIsUnlocked(true)
        } else {
          setNeedsPin(true)
          setIsUnlocked(false)
        }
      } catch {
        if (!cancelled) {
          setNeedsPin(false)
          setIsUnlocked(true)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [attempt])

  const handleUnlock = useCallback(async () => {
    if (!pin.trim()) {
      setError('Escribe el PIN.')
      return
    }

    setIsChecking(true)
    setError('')

    try {
      const ok = await verifyPin(pin)
      if (ok) {
        markPinUnlocked()
        setIsUnlocked(true)
        setPin('')
      } else {
        setError('PIN incorrecto. Intenta de nuevo.')
        setPin('')
      }
    } catch {
      setError('No se pudo verificar el PIN. Intenta de nuevo.')
    } finally {
      setIsChecking(false)
    }
  }, [pin])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUnlock()
  }

  // Cargando configuración
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-500">
        <Loader2 className="mr-2 size-6 animate-spin text-[#ef4444]" /> Verificando seguridad...
      </div>
    )
  }

  // Sin PIN configurado o ya desbloqueado → contenido directo
  if (!needsPin || isUnlocked) {
    return <>{children}</>
  }

  // Protegido: mostrar modal de PIN
  return (
    <div className="relative">
      {/* Contenido oculto (blurred placeholder) */}
      <div className="pointer-events-none select-none overflow-hidden" aria-hidden="true">
        <div className="blur-[8px] opacity-30">
          {children}
        </div>
      </div>

      {/* Modal de PIN superpuesto */}
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="ds-card w-full max-w-sm rounded-2xl p-6 space-y-5 mx-4">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-[#ef4444]/30 bg-[#ef4444]/10">
              <Lock className="size-7 text-[#ef4444]" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-black uppercase tracking-wider text-white">
                Acceso restringido
              </h2>
              <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--ds-txt-3)' }}>
                Ingresa el PIN para acceder a <span className="text-[#ef4444]">{sectionName}</span>
              </p>
            </div>
          </div>

          <div className="relative">
            <input
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                setError('')
              }}
              onKeyDown={handleKeyDown}
              placeholder="••••"
              autoFocus
              maxLength={12}
              className="ds-input ds-input-icon text-center font-mono text-xl tracking-[0.4em] pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
              tabIndex={-1}
            >
              {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400">
              <ShieldAlert className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleUnlock}
            disabled={isChecking || !pin.trim()}
            className="ds-btn-gold w-full py-3 text-xs uppercase tracking-widest"
          >
            {isChecking ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Verificando...
              </>
            ) : (
              <>
                <Lock className="size-4" /> Desbloquear
              </>
            )}
          </button>

          <p className="text-center text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ds-txt-3)' }}>
            El PIN se guarda en Ajustes del Sistema
          </p>
        </div>
      </div>
    </div>
  )
}
