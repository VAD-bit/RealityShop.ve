'use client'

import { useEffect, useRef, useState } from 'react'
import { Syne } from 'next/font/google'

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '800'],
  display: 'swap',
})

const WORD = 'AMPLIKAA'.split('')

type Phase = 'loading' | 'exiting' | 'done'

export function AdminSplash() {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const DURATION = 2600
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION, 1)
      // easing suave tipo carga real
      const eased = 1 - Math.pow(1 - t, 2.2)
      setProgress(Math.round(eased * 100))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setTimeout(() => setPhase('exiting'), 300)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'exiting') return
    const timer = setTimeout(() => setPhase('done'), 600)
    return () => clearTimeout(timer)
  }, [phase])

  const handleSkip = () => {
    if (phase === 'loading') setPhase('exiting')
  }

  if (phase === 'done') return null

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[200] overflow-hidden bg-[#050505] transition-opacity duration-500 ${
        phase === 'exiting' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-label="Entrando a Reality Shop"
    >
      {/* ═══ FONDO MOTION: auroras Amplikaa ═══ */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-40 top-1/4 h-[520px] w-[520px] animate-[aurora-a_11s_ease-in-out_infinite_alternate] rounded-full bg-[#00f0ff]/10 blur-[150px]" />
        <div className="absolute -right-40 bottom-0 h-[560px] w-[560px] animate-[aurora-b_13s_ease-in-out_infinite_alternate] rounded-full bg-[#7b2cbf]/14 blur-[160px]" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 animate-[aurora-a_9s_ease-in-out_infinite_alternate-reverse] rounded-full bg-[#00f0ff]/6 blur-[120px]" />
        {/* Viñeta */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,#050505_88%)]" />
      </div>

      {/* ═══ FONDO MOTION: la palabra se forma ═══ */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center select-none"
        aria-hidden="true"
      >
        <span
          className={`${syne.className} mb-3 animate-[powered-in_0.8s_ease-out_0.15s_both] text-[11px] font-semibold uppercase tracking-[0.55em] text-white/55 md:mb-5 md:text-sm`}
        >
          Powered by
        </span>

        <div className="animate-[word-float_7s_ease-in-out_infinite]">
          <span
            className={`${syne.className} flex text-[15vw] font-extrabold uppercase leading-none tracking-tight md:text-[11vw] lg:text-[9.5vw]`}
          >
            {WORD.map((letter, i) => {
              const isBlueAA = i >= 6
              return (
                <span
                  key={`${letter}-${i}`}
                  className={`inline-block animate-[letter-form_0.75s_cubic-bezier(0.22,1,0.36,1)_both] ${
                    isBlueAA
                      ? 'animate-[letter-form_0.75s_cubic-bezier(0.22,1,0.36,1)_both,aa-glow_3.2s_ease-in-out_1.6s_infinite] bg-gradient-to-br from-[#00f0ff] to-[#7b2cbf] bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(0,240,255,0.35)]'
                      : 'text-white'
                  }`}
                  style={{ animationDelay: `${0.35 + i * 0.09}s, ${1.7 + i * 0.08}s` }}
                >
                  {letter}
                </span>
              )
            })}
          </span>
        </div>

        {/* Brillo que barre la palabra formada */}
        <div className="relative mt-1 h-px w-[70vw] max-w-3xl overflow-hidden">
          <span className="absolute inset-0 animate-[shine-sweep_3.4s_ease-in-out_1.9s_infinite] bg-gradient-to-r from-transparent via-[#00f0ff]/70 to-transparent" />
        </div>
      </div>

      {/* ═══ SCRIM izquierdo para legibilidad ═══ */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/78 to-transparent md:via-[#050505]/55"
        aria-hidden="true"
      />

      {/* ═══ CONTENIDO (estilo portada DientesSanos) ═══ */}
      <div className="relative z-10 flex h-full items-center px-6 md:px-14 lg:px-24">
        <div className="w-full max-w-lg animate-[content-in_0.9s_ease-out_0.4s_both]">
          {/* Logo Reality Shop — sin fondo (screen) */}
          <img
            src="/hero-texture.jpeg"
            alt="Reality Shop"
            className="mb-8 h-36 w-auto object-contain mix-blend-screen contrast-125 brightness-110 md:mb-10 md:h-48"
          />

          <h1 className="font-sans text-3xl font-medium leading-tight text-white md:text-[42px]">
            Entrando a
            <br />
            Reality Shop
          </h1>

          {/* Barra de progreso */}
          <div className="mt-8 flex items-center gap-5 md:mt-10">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-11 text-right font-mono text-sm font-bold text-white/85">
              {progress}%
            </span>
          </div>

          <p className="mt-5 text-xs text-white/45 md:text-sm">Cargando tu experiencia...</p>
        </div>
      </div>
    </div>
  )
}
