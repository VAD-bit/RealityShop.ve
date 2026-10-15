'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Mail, Loader2, AlertTriangle, ArrowRight, Package, ClipboardList, ShoppingCart, BarChart3 } from 'lucide-react'
import { Syne } from 'next/font/google'
import { createAuthClient } from '@/lib/supabase/auth-client'
import { getUserProfile, roleHome } from '@/lib/auth'
import { AdminSplash } from '@/components/admin-splash'

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '800'],
  display: 'swap',
})

const WORD = 'AMPLIKAA'.split('')

const FEATURES = [
  { icon: Package, title: 'Inventario', desc: 'Controla tu stock\nen tiempo real' },
  { icon: ClipboardList, title: 'Pedidos', desc: 'Gestiona cada orden\ncon facilidad' },
  { icon: ShoppingCart, title: 'POS / Venta', desc: 'Registra ventas\nal instante' },
  { icon: BarChart3, title: 'Finanzas', desc: 'Monitorea tus ingresos\ny crecimiento' },
]

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
    <main className="relative min-h-screen overflow-hidden bg-[#050505] p-3 md:p-5">
      {/* ═══ FONDO MOTION — misma animación Amplikaa del splash ═══ */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* Auroras */}
        <div className="absolute -left-40 top-1/4 h-[520px] w-[520px] animate-[aurora-a_11s_ease-in-out_infinite_alternate] rounded-full bg-[#00f0ff]/10 blur-[150px]" />
        <div className="absolute -right-40 bottom-0 h-[560px] w-[560px] animate-[aurora-b_13s_ease-in-out_infinite_alternate] rounded-full bg-[#7b2cbf]/14 blur-[160px]" />
        <div className="absolute left-1/3 top-1/2 h-72 w-72 animate-[aurora-a_9s_ease-in-out_infinite_alternate-reverse] rounded-full bg-[#00f0ff]/6 blur-[120px]" />

        {/* La palabra formándose, sutil al fondo */}
        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-[0.12] select-none">
          <span
            className={`${syne.className} mb-3 animate-[powered-in_0.8s_ease-out_0.15s_both] text-xs font-semibold uppercase tracking-[0.55em] text-white md:mb-5 md:text-sm`}
          >
            Powered by
          </span>
          <div className="animate-[word-float_7s_ease-in-out_infinite]">
            <span
              className={`${syne.className} flex text-[15vw] font-extrabold uppercase leading-none tracking-tight md:text-[11vw] lg:text-[9vw]`}
            >
              {WORD.map((letter, i) => {
                const isBlueAA = i >= 6
                return (
                  <span
                    key={`${letter}-${i}`}
                    className={`inline-block animate-[letter-form_0.75s_cubic-bezier(0.22,1,0.36,1)_both] ${
                      isBlueAA
                        ? 'bg-gradient-to-br from-[#00f0ff] to-[#7b2cbf] bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(0,240,255,0.35)]'
                        : 'text-white'
                    }`}
                    style={{ animationDelay: `${0.35 + i * 0.09}s` }}
                  >
                    {letter}
                  </span>
                )
              })}
            </span>
          </div>
        </div>

        {/* Viñeta */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#050505_92%)]" />
      </div>

      {/* ═══ CONTENEDOR GRANDE REDONDEADO (estilo DientesSanos) ═══ */}
      <div className="relative z-10 flex min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[28px] border border-white/[0.07] bg-black/45 backdrop-blur-md md:min-h-[calc(100vh-2.5rem)]">
        <div className="grid flex-1 lg:grid-cols-[1.08fr_0.92fr]">
          {/* ── IZQUIERDA: marca ── */}
          <section className="relative flex flex-col justify-center gap-9 px-7 py-12 md:px-14 md:py-16 lg:px-16">
            {/* Logo Reality Shop — sin fondo */}
            <img
              src="/hero-texture.jpeg"
              alt="Reality Shop"
              className="h-28 w-auto object-contain mix-blend-screen contrast-125 brightness-110 md:h-36"
            />

            <div className="animate-[content-in_0.9s_ease-out_both]">
              <h1 className="text-[34px] font-black uppercase leading-[1.04] tracking-tight text-white md:text-[46px] lg:text-[54px]">
                El control
                <br />
                absoluto de tu{' '}
                <span className="bg-gradient-to-r from-[#ef4444] to-[#ff7a6e] bg-clip-text text-transparent">
                  tienda
                </span>
              </h1>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-white/55 md:text-[15px]">
                Gestiona tu inventario, pedidos y ventas en un solo lugar y ofrece una
                experiencia de compra inolvidable a cada cliente.
              </p>
            </div>
          </section>

          {/* ── DERECHA: tarjeta de acceso ── */}
          <section className="flex items-center justify-center px-5 pb-12 pt-2 md:px-10 md:py-14">
            <div className="w-full max-w-md animate-[content-in_0.9s_ease-out_0.15s_both] rounded-[26px] border border-white/[0.08] bg-[#111114]/88 p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] md:p-9">
              <h2 className="text-center text-xl font-black uppercase tracking-wide text-white md:text-2xl">
                ¡Bienvenido a <span className="text-[#ef4444]">Reality Shop!</span>
              </h2>
              <p className="mt-3 text-center text-[13px] text-white/50">
                Ingresa tus credenciales para continuar
              </p>

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-[13px] font-medium text-white/65">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ingresa tu correo"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 pr-11 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#ef4444]/60 focus:bg-white/[0.06]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-medium text-white/65">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingresa tu contraseña"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 pr-11 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#ef4444]/60 focus:bg-white/[0.06]"
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
                  className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ef4444] to-[#dc2626] py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#ef4444]/25 transition-all hover:shadow-[#ef4444]/40 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Iniciando sesión...
                    </span>
                  ) : (
                    <>
                      Iniciar sesión
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* ── BARRA INFERIOR: features ── */}
        <div className="border-t border-white/[0.07] bg-white/[0.02]">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className={`flex items-start gap-3.5 px-5 py-5 md:px-7 md:py-6 ${
                    i % 2 === 0 ? 'border-r border-white/[0.06]' : ''
                  } ${i < 2 ? 'border-b border-white/[0.06] lg:border-b-0' : ''} lg:border-r lg:last:border-r-0`}
                >
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#ef4444]/25 bg-[#ef4444]/10">
                    <Icon className="size-[17px] text-[#ef4444]" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-white">{f.title}</p>
                    <p className="mt-0.5 whitespace-pre-line text-[11.5px] leading-snug text-white/45">
                      {f.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#050505]">
          <Loader2 className="size-6 animate-spin text-[#ef4444]" />
        </main>
      }
    >
      <AdminSplash />
      <LoginForm />
    </Suspense>
  )
}
