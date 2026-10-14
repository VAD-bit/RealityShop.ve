'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import {
  Menu,
  X,
  LayoutDashboard,
  ClipboardList,
  LogOut,
} from 'lucide-react'
import { createAuthClient } from '@/lib/supabase/auth-client'
import { getUserProfile, UserProfile } from '@/lib/auth'

const navItems = [
  { name: 'Resumen', href: '/advisor', icon: LayoutDashboard },
  { name: 'Pedidos', href: '/advisor/pedidos', icon: ClipboardList },
]

export default function AdvisorLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState({ top: 0, height: 0, ready: false })

  useEffect(() => {
    const supabase = createAuthClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const p = await getUserProfile(user.email)
        setProfile(p)
      }
    })
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      const supabase = createAuthClient()
      await supabase.auth.signOut()
    } finally {
      setIsLoggingOut(false)
      router.replace('/admin/login')
      router.refresh()
    }
  }

  useEffect(() => {
    if (!navRef.current) return
    const active = navRef.current.querySelector<HTMLElement>('[data-active="true"]')
    if (active) {
      setIndicator({ top: active.offsetTop, height: active.offsetHeight, ready: true })
    } else {
      setIndicator((prev) => ({ ...prev, ready: false }))
    }
  }, [pathname])

  return (
    <div className="ds-root ds-anim-in relative flex min-h-screen flex-col overflow-x-hidden selection:bg-[#ef4444] selection:text-[#111] md:flex-row">
      {/* TEXTURA DE FONDO */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-70"
        style={{
          backgroundImage: "url('/textura.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden="true"
      />
      {/* GLOWS AMBIENTES (rojo Reality Shop) */}
      <div className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-[#ef4444]/[0.06] blur-[130px] z-[1]" />
      <div className="pointer-events-none fixed top-1/2 -right-32 h-96 w-96 rounded-full bg-[#dc2626]/[0.05] blur-[140px] z-[1]" />

      {/* HEADER MÓVIL */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.06] bg-[#1e1e22]/90 px-5 py-4 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <img
            src="/Realityshop.png"
            alt="Reality Shop"
            className="h-8 w-auto object-contain"
          />
          <span className="ml-1 rounded-full border border-[#ef4444]/30 bg-[#ef4444]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#ef4444]">
            Asesor
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:text-white"
          aria-label="Abrir menú"
        >
          <Menu className="size-6" />
        </button>
      </header>

      {/* BACKDROP MÓVIL */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR ASESOR */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-[260px] flex-col justify-between border-r border-white/[0.04] bg-[#1e1e22] p-5 shadow-[4px_0_40px_rgba(0,0,0,0.6)] transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 md:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative z-10">
          {/* Logo */}
          <div className="mb-8 flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/Realityshop.png"
                alt="Reality Shop"
                className="h-9 w-auto object-contain"
              />
              <div>
                <span className="block text-[9px] font-bold uppercase tracking-widest text-[#ef4444]">
                  Panel Asesor
                </span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:text-white md:hidden"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Nombre del asesor */}
          {profile?.advisor_name && (
            <div className="mb-6 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/[0.06] px-3.5 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#ef4444]/70">
                Sesión de
              </p>
              <p className="mt-0.5 text-sm font-black uppercase text-white">
                {profile.advisor_name}
              </p>
            </div>
          )}

          {/* Nav con pill gliding */}
          <nav ref={navRef} className="relative space-y-1">
            {indicator.ready && (
              <div
                className="pointer-events-none absolute left-0 right-0 rounded-[9px] border border-[#ef4444]/25 bg-gradient-to-r from-[#ef4444]/[0.14] to-[#ef4444]/[0.04] transition-all duration-[220ms] ease-[cubic-bezier(0.25,1,0.5,1)]"
                style={{
                  top: indicator.top,
                  height: indicator.height,
                }}
              />
            )}

            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={isActive}
                  onClick={() => setSidebarOpen(false)}
                  className={`relative flex items-center gap-3 rounded-[9px] px-3.5 py-3 text-[13.5px] transition-all duration-200 ${
                    isActive
                      ? 'font-bold text-[#f8f8f8]'
                      : 'font-medium text-[#c8c8c8]/50 hover:translate-x-[3px] hover:text-[#f5f5f5]'
                  }`}
                >
                  <Icon
                    className={`size-[17px] transition-all ${
                      isActive
                        ? 'text-[#ef4444] drop-shadow-[0_0_7px_rgba(239,68,68,0.55)]'
                        : 'text-[#f5f5f5]/45'
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.7}
                  />
                  {item.name}
                  {isActive && (
                    <span className="absolute right-3 size-[5px] rounded-full bg-[#ef4444] shadow-[0_0_6px_#ef4444,0_0_14px_rgba(239,68,68,0.5)]" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Parte inferior */}
        <div className="relative z-10 space-y-1.5 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-[9px] border border-[#ff453a]/[0.12] bg-[#ff453a]/[0.04] px-3.5 py-3 text-[13.5px] font-medium text-[#ff5a4e] transition-all hover:border-[#ff453a]/35 hover:bg-[#ff453a]/10 disabled:opacity-50"
          >
            <LogOut className="size-[17px]" strokeWidth={1.7} />
            {isLoggingOut ? 'Cerrando...' : 'Cerrar Sesión'}
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="relative z-10 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
    </div>
  )
}
