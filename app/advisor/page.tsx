'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  ShoppingBag,
  User,
  Wallet,
  Banknote,
  Calendar,
  Trophy,
  Loader2,
  Wrench,
  Hammer,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createAuthClient } from '@/lib/supabase/auth-client'
import { getUserProfile } from '@/lib/auth'
import { getSettings, AppSettings, DEFAULT_SETTINGS } from '@/lib/settings'

interface AdvisorStats {
  ventasMes: number
  transaccionesMes: number
  topShoe: { name: string; qty: number } | null
  topClient: { name: string; total: number } | null
  comisionPendiente: number
  comisionCobrada: number
  tasa: number
  mantenimientoCobrado: number
  mantenimientoPendiente: number
  esDesarrollador: boolean
}

export default function AdvisorResumenPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [advisorName, setAdvisorName] = useState<string>('')
  const [stats, setStats] = useState<AdvisorStats | null>(null)
  const [mesLabel, setMesLabel] = useState<string>('')
  const [maintPct, setMaintPct] = useState<number>(3)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setIsLoading(true)
    setError(null)

    try {
      // 1. Perfil del asesor
      const auth = createAuthClient()
      const { data: { user } } = await auth.auth.getUser()
      const profile = await getUserProfile(user?.email)
      const name = profile?.advisor_name || ''
      setAdvisorName(name)

      if (!name) {
        setError('Tu cuenta no tiene un perfil de asesor asignado. Contacta al administrador.')
        return
      }

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      setMesLabel(
        monthStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      )

      const supabase = createClient()

      // Cada query por separado: si una tabla falta, no rompe todo el resumen
      const [salesRes, payRes, advRes, settings, allSalesRes] = await Promise.allSettled([
        supabase
          .from('sales')
          .select(
            'total_price, quantity, payment_status, created_at, customer_name, products(name, category)'
          )
          .eq('advisor_name', name)
          .order('created_at', { ascending: false }),
        supabase
          .from('payment_records')
          .select('amount, type')
          .eq('advisor_name', name),
        supabase.from('advisors').select('commission_pct').eq('name', name).single(),
        getSettings().catch(() => DEFAULT_SETTINGS),
        // ventas globales (para calcular mantenimiento sobre ingresos totales)
        supabase
          .from('sales')
          .select('total_price, payment_status'),
      ])

      const sales =
        salesRes.status === 'fulfilled' && !salesRes.value.error
          ? ((salesRes.value.data as any[]) || [])
          : []
      const payments =
        payRes.status === 'fulfilled' && !payRes.value.error
          ? ((payRes.value.data as any[]) || [])
          : []
      const commissionPct =
        advRes.status === 'fulfilled' && !advRes.value.error
          ? Number(advRes.value.data?.commission_pct)
          : NaN
      const settingsData =
        settings.status === 'fulfilled' ? settings.value : DEFAULT_SETTINGS
      setMaintPct(settingsData.maintenancePct || 3)
      const allSales =
        allSalesRes.status === 'fulfilled' && !allSalesRes.value.error
          ? ((allSalesRes.value.data as any[]) || [])
          : []

      // Ventas del mes (excluyendo cortesía)
      const monthSales = sales.filter(
        (s) =>
          new Date(s.created_at) >= monthStart && s.payment_status !== 'cortesia'
      )

      const ventasMes = monthSales.reduce(
        (sum, s) => sum + (Number(s.total_price) || 0),
        0
      )
      const transaccionesMes = monthSales.length

      // Zapato más vendido del mes (por unidades)
      const byProduct = new Map<string, { name: string; qty: number }>()
      monthSales.forEach((s) => {
        const n = s.products?.name || 'Ingreso Directo'
        const entry = byProduct.get(n) || { name: n, qty: 0 }
        entry.qty += Number(s.quantity) || 1
        byProduct.set(n, entry)
      })
      const topShoe =
        [...byProduct.values()].sort((a, b) => b.qty - a.qty)[0] || null

      // Mejor cliente del mes (por monto)
      const byClient = new Map<string, { name: string; total: number }>()
      monthSales.forEach((s) => {
        const n = s.customer_name || 'Cliente General'
        const entry = byClient.get(n) || { name: n, total: 0 }
        entry.total += Number(s.total_price) || 0
        byClient.set(n, entry)
      })
      const topClient =
        [...byClient.values()].sort((a, b) => b.total - a.total)[0] || null

      // Comisiones (históricas: ganada = total ventas × tasa)
      const tasa = commissionPct || settingsData.commissionPct || 5
      const totalVentas = sales
        .filter((s) => s.payment_status !== 'cortesia')
        .reduce((sum, s) => sum + (Number(s.total_price) || 0), 0)
      const comisionCobrada = payments
        .filter((p) => p.type === 'comision')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      const comisionGanada = (totalVentas * tasa) / 100
      const comisionPendiente = Math.max(0, comisionGanada - comisionCobrada)

      // Mantenimiento (solo visible para el dueño/desarrollador)
      const esDesarrollador =
        (settingsData.maintenanceOwner || 'Victor Diaz') === name
      const ingresosGlobales = allSales
        .filter((s) => s.payment_status !== 'cortesia')
        .reduce((sum, s) => sum + (Number(s.total_price) || 0), 0)
      const mantenimientoCobrado = payments
        .filter((p) => p.type === 'mantenimiento')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      const mantenimientoAcumulado =
        (ingresosGlobales * (settingsData.maintenancePct || 0)) / 100
      const mantenimientoPendiente = Math.max(
        0,
        mantenimientoAcumulado - mantenimientoCobrado
      )

      setStats({
        ventasMes,
        transaccionesMes,
        topShoe,
        topClient,
        comisionPendiente,
        comisionCobrada,
        tasa,
        mantenimientoCobrado,
        mantenimientoPendiente,
        esDesarrollador,
      })
    } catch (err: any) {
      console.error('Error cargando resumen del asesor:', err)
      setError('No se pudieron cargar las estadísticas. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#ef4444]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8 pb-12">
        <div>
          <p className="ds-eyebrow">Panel asesor</p>
          <h1 className="ds-text-gold mt-1 text-3xl tracking-tight">Resumen</h1>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-8 text-center">
          <p className="text-sm font-bold uppercase text-amber-400">{error}</p>
        </div>
      </div>
    )
  }

  const monthName = mesLabel || 'este mes'

  return (
    <div className="space-y-8 pb-12">
      {/* CABECERA */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="ds-eyebrow">Panel asesor</p>
          <h1 className="ds-text-gold mt-1 text-3xl tracking-tight">
            Hola, {advisorName}
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
            Tu rendimiento en {monthName}
          </p>
        </div>
        <button
          onClick={loadStats}
          className="ds-btn-ghost px-4 py-3 text-xs uppercase tracking-widest"
        >
          <TrendingUp className="size-4 text-[#ef4444]" />
          Actualizar
        </button>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* 1. Ventas del mes */}
        <div className="ds-card ds-anim-in ds-stagger-1 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Ventas del mes</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-[#ef4444]/20 bg-[#242428]">
              <TrendingUp className="size-4 text-[#ef4444]" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-white">
            ${stats?.ventasMes.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </p>
          <span className="mt-1 block text-[10px] font-bold" style={{ color: 'var(--ds-txt-3)' }}>
            {stats?.transaccionesMes || 0} transacciones en {monthName}
          </span>
        </div>

        {/* 2. Zapato más vendido */}
        <div className="ds-card ds-anim-in ds-stagger-2 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Zapato más vendido</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <Trophy className="size-4 text-amber-400" />
            </div>
          </div>
          <p className="mt-3 font-heading text-lg font-black uppercase leading-tight text-white">
            {stats?.topShoe?.name || '—'}
          </p>
          <span className="mt-1 block text-[10px] font-bold text-amber-400">
            {stats?.topShoe ? `${stats.topShoe.qty} unidades vendidas` : 'Sin ventas este mes'}
          </span>
        </div>

        {/* 3. Mejor cliente */}
        <div className="ds-card ds-anim-in ds-stagger-3 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Mejor cliente</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10">
              <User className="size-4 text-sky-400" />
            </div>
          </div>
          <p className="mt-3 font-heading text-lg font-black uppercase leading-tight text-white">
            {stats?.topClient?.name || '—'}
          </p>
          <span className="mt-1 block text-[10px] font-bold text-sky-400">
            {stats?.topClient
              ? `$${stats.topClient.total.toFixed(2)} comprados`
              : 'Sin clientes este mes'}
          </span>
        </div>

        {/* 4. Comisión pendiente */}
        <div className="ds-card ds-anim-in ds-stagger-4 rounded-xl p-5" style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)' }}>
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow" style={{ color: '#fbbf24' }}>Comisión pendiente</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <Wallet className="size-4 text-amber-400" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-amber-400">
            ${(stats?.comisionPendiente || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-[10px] font-bold" style={{ color: 'var(--ds-txt-3)' }}>
            Tasa: {stats?.tasa || 10}% — histórica
          </span>
        </div>

        {/* 5. Comisión cobrada */}
        <div className="ds-card ds-anim-in ds-stagger-5 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Comisión cobrada</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <Banknote className="size-4 text-emerald-400" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-emerald-400">
            ${(stats?.comisionCobrada || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-[10px] font-bold" style={{ color: 'var(--ds-txt-3)' }}>
            Pagos de comisión recibidos
          </span>
        </div>

        {/* 6. Mantenimiento cobrado (solo desarrollador) */}
        {stats?.esDesarrollador && (
          <div className="ds-card ds-anim-in ds-stagger-6 rounded-xl p-5" style={{ borderColor: 'rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.06)' }}>
            <div className="flex items-center justify-between">
              <span className="ds-eyebrow" style={{ color: '#38bdf8' }}>Mantenimiento cobrado</span>
              <div className="flex size-9 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10">
                <Hammer className="size-4 text-sky-400" />
              </div>
            </div>
            <p className="mt-3 font-mono text-2xl font-black text-sky-400">
              ${(stats?.mantenimientoCobrado || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="mt-1 block text-[10px] font-bold" style={{ color: 'var(--ds-txt-3)' }}>
              Pagos de mantenimiento recibidos
            </span>
          </div>
        )}

        {/* 7. Mantenimiento pendiente (solo desarrollador) */}
        {stats?.esDesarrollador && (
          <div className="ds-card ds-anim-in ds-stagger-7 rounded-xl p-5" style={{ borderColor: 'rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.06)' }}>
            <div className="flex items-center justify-between">
              <span className="ds-eyebrow" style={{ color: '#f43f5e' }}>Mantenimiento pendiente</span>
              <div className="flex size-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10">
                <Wrench className="size-4 text-rose-400" />
              </div>
            </div>
            <p className="mt-3 font-mono text-2xl font-black text-rose-400">
              ${(stats?.mantenimientoPendiente || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="mt-1 block text-[10px] font-bold" style={{ color: 'var(--ds-txt-3)' }}>
              {maintPct}% de ingresos globales — por cobrar
            </span>
          </div>
        )}
      </div>

      {/* NOTA */}
      <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="flex items-start gap-3">
          <Calendar className="mt-0.5 size-4 shrink-0 text-[#ef4444]" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-neutral-300">
              Resumen de {monthName}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Las ventas, zapato más vendido y mejor cliente se calculan con las ventas de este
              mes. Las comisiones son históricas (todo lo acumulado). La comisión pendiente
              descuenta lo que ya cobraste.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
