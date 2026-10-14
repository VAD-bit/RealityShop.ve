'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Users, UserPlus, DollarSign, ShoppingBag, Award, Plus, X, Loader2 } from 'lucide-react'
import { ADVISORS as DEFAULT_ADVISORS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { getSettings, DEFAULT_SETTINGS } from '@/lib/settings'

const supabase = createClient()

interface SaleRecord {
  id: string
  advisor_name?: string
  total_price: number
  quantity: number
  created_at: string
  products?: {
    name: string
    category: string
  }
}

interface AdvisorRecord {
  id: string
  name: string
  commission_pct?: number | null
}

export default function AdvisorsPage() {
  const [advisors, setAdvisors] = useState<AdvisorRecord[]>(DEFAULT_ADVISORS)
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [newAdvisorName, setNewAdvisorName] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [defaultCommissionPct, setDefaultCommissionPct] = useState<number>(
    DEFAULT_SETTINGS.commissionPct
  )

  // Cargar asesores, ventas y ajustes de comisión
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Cargar asesores de Supabase
      const { data: advData, error: advError } = await supabase
        .from('advisors')
        .select('*')
        .order('name', { ascending: true })

      if (!advError && advData && advData.length > 0) {
        setAdvisors(advData as AdvisorRecord[])
      } else {
        // Fallback a constantes o insertar defaults si no hay
        setAdvisors(DEFAULT_ADVISORS)
      }

      // Cargar ajustes (comisión global por defecto)
      try {
        const s = await getSettings()
        setDefaultCommissionPct(s.commissionPct)
      } catch {
        setDefaultCommissionPct(DEFAULT_SETTINGS.commissionPct)
      }

      // Cargar ventas para calcular comisiones y reportes
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*, products(name, category)')
        .order('created_at', { ascending: false })

      if (salesError) throw salesError
      if (salesData) setSales(salesData as SaleRecord[])
    } catch (error) {
      console.error('Error cargando datos de asesores:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Calcular métricas y reporte por asesor (tasa configurable por asesor o global)
  const advisorsReport = useMemo(() => {
    const reportMap: Record<
      string,
      {
        totalSales: number
        totalUnits: number
        transactionsCount: number
        commission: number
        commissionPct: number
        salesList: SaleRecord[]
      }
    > = {}

    // Tasa de comisión por asesor (si tiene) o la global
    const rateFor = (name: string): number => {
      const adv = advisors.find((a) => a.name === name)
      if (adv && adv.commission_pct !== undefined && adv.commission_pct !== null) {
        return Number(adv.commission_pct)
      }
      return defaultCommissionPct
    }

    // Inicializar mapa con todos los asesores conocidos
    advisors.forEach((adv) => {
      reportMap[adv.name] = {
        totalSales: 0,
        totalUnits: 0,
        transactionsCount: 0,
        commission: 0,
        commissionPct: rateFor(adv.name),
        salesList: [],
      }
    })

    // Procesar ventas
    sales.forEach((sale) => {
      const advName = sale.advisor_name || 'General'
      if (!reportMap[advName]) {
        reportMap[advName] = {
          totalSales: 0,
          totalUnits: 0,
          transactionsCount: 0,
          commission: 0,
          commissionPct: rateFor(advName),
          salesList: [],
        }
      }

      const price = Number(sale.total_price) || 0
      const qty = Number(sale.quantity) || 1

      reportMap[advName].totalSales += price
      reportMap[advName].totalUnits += qty
      reportMap[advName].transactionsCount += 1
      reportMap[advName].salesList.push(sale)
    })

    // Calcular comisión con la tasa correspondiente
    Object.keys(reportMap).forEach((name) => {
      reportMap[name].commission =
        (reportMap[name].totalSales * reportMap[name].commissionPct) / 100
    })

    return reportMap
  }, [advisors, sales, defaultCommissionPct])

  // Agregar nuevo asesor
  const handleAddAdvisor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAdvisorName.trim()) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('advisors').insert({
        name: newAdvisorName.trim(),
      })

      if (error) {
        // Si la tabla advisors no existe o hay error, lo manejamos localmente
        console.warn('Error insertando en tabla advisors de Supabase (posiblemente no creada):', error.message)
      }

      setNewAdvisorName('')
      setIsModalOpen(false)
      await fetchData()
    } catch (error) {
      console.error('Error agregando asesor:', error)
      alert('Error al agregar asesor')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* CABECERA */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="ds-eyebrow">Equipo de ventas</p>
          <h1 className="ds-text-gold mt-1 text-3xl tracking-tight">Asesores y Comisiones</h1>
          <p className="mt-1 text-xs font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
            Control de equipo y cálculo de comisiones ({defaultCommissionPct}% global)
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="ds-btn-gold px-6 py-3 text-xs uppercase tracking-widest"
        >
          <UserPlus className="size-4" />
          Agregar Asesor
        </button>
      </div>

      {/* TARJETAS DE REPORTE POR ASESOR */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-neutral-500">
          <Loader2 className="mr-2 size-6 animate-spin text-red-600" /> Cargando reportes de asesores...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {advisors.map((advisor) => {
            const data = advisorsReport[advisor.name] || {
              totalSales: 0,
              totalUnits: 0,
              transactionsCount: 0,
              commission: 0,
              commissionPct: defaultCommissionPct,
              salesList: [],
            }

            return (
              <div
                key={advisor.id || advisor.name}
                className="ds-card ds-anim-in relative overflow-hidden rounded-2xl p-6"
              >
                <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#ef4444]/[0.04] blur-2xl" />

                <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-[#ef4444]/30 bg-gradient-to-br from-[#ef4444] to-[#dc2626] font-black text-[#111] shadow-md shadow-[#ef4444]/20">
                      {advisor.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-black uppercase tracking-wide text-white">
                        {advisor.name}
                      </h3>
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
                        {data.transactionsCount} ventas registradas
                      </span>
                    </div>
                  </div>
                  <Award className="size-5 text-[#ef4444]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                      Ventas Totales
                    </span>
                    <span className="font-mono text-lg font-black text-emerald-400 mt-1 block">
                      ${data.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                      Comisión ({data.commissionPct}%)
                    </span>
                    <span className="font-mono text-lg font-black text-amber-400 mt-1 block">
                      ${data.commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Últimas Ventas Realizadas
                  </span>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                    {data.salesList.length === 0 ? (
                      <p className="text-[10px] italic text-neutral-500">Sin ventas registradas aún.</p>
                    ) : (
                      data.salesList.slice(0, 5).map((sale, idx) => (
                        <div
                          key={sale.id || idx}
                          className="flex items-center justify-between text-xs rounded-xl bg-neutral-950 px-3 py-2 border border-neutral-800/60"
                        >
                          <span className="font-bold uppercase text-neutral-300 truncate max-w-[140px]">
                            {sale.products?.name || 'Ingreso Directo'}
                          </span>
                          <span className="font-mono font-black text-emerald-400">
                            ${Number(sale.total_price).toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL AGREGAR ASESOR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-heading text-lg font-black uppercase tracking-wider text-white">
                Agregar Nuevo Asesor
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleAddAdvisor} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">
                  Nombre Completo del Asesor
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Rodriguez"
                  value={newAdvisorName}
                  onChange={(e) => setNewAdvisorName(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white outline-none focus:border-red-600 transition"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 rounded-xl border border-neutral-800 py-3 font-heading text-xs font-bold uppercase text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 rounded-xl bg-red-600 py-3 font-heading text-xs font-black uppercase text-white hover:bg-red-700 transition disabled:opacity-50 shadow-lg shadow-red-600/30"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Asesor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
