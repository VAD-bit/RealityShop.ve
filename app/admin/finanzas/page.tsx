'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Calendar,
  ArrowUpRight,
  User,
  Search,
  Plus,
  Wrench,
  Award,
  Clock,
  Edit3,
  X,
  Download,
  BarChart3,
  Package,
  Gift,
  Wallet,
  CheckCircle,
  Trash2,
  Loader2,
} from 'lucide-react'
import { ADVISORS as DEFAULT_ADVISORS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { exportCsv, money } from '@/lib/csv'
import { getSettings, AppSettings, DEFAULT_SETTINGS } from '@/lib/settings'
import { ProductItem } from '@/lib/types'

const supabase = createClient()

type FinanceSection = 'transacciones' | 'cobrar' | 'comisiones' | 'mantenimiento' | 'rentabilidad'

const SECTIONS: { id: FinanceSection; label: string; icon: any }[] = [
  { id: 'transacciones', label: 'Transacciones', icon: DollarSign },
  { id: 'cobrar', label: 'Por Cobrar', icon: Clock },
  { id: 'comisiones', label: 'Comisiones', icon: Award },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
  { id: 'rentabilidad', label: 'Rentabilidad', icon: TrendingUp },
]

interface SaleRecord {
  id: string
  product_id?: string
  inventory_id?: string | null
  advisor_name?: string
  customer_name?: string
  total_price: number
  quantity: number
  quantity_paid?: number
  quantity_pending?: number
  payment_status?: 'pagado' | 'por_cobrar' | 'cortesia'
  payment_method?: string | null
  payment_reference?: string | null
  custom_total?: number | null
  tip_amount?: number | null
  created_at: string
  products?: {
    name: string
    category: string
    price?: number
    cost_price?: number
    profit_margin?: number
  }
  inventory?: {
    id: string
    size_or_detail: string
    stock: number
  } | null
}

interface PaymentRecord {
  id: string
  type: 'mantenimiento' | 'comision'
  advisor_name: string
  amount: number
  reference: string
  created_at: string
}

const DIGITAL_PAYMENT_METHODS = ['Pago Móvil', 'Binance', 'Pago Movil', 'Zelle']

function isDigitalPaymentPending(sale: SaleRecord): boolean {
  const method = sale.payment_method?.toLowerCase() || ''
  return DIGITAL_PAYMENT_METHODS.some((m) => method.includes(m.toLowerCase()))
}

export default function FinancePage() {
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [advisors, setAdvisors] = useState<{ id: string; name: string; commission_pct?: number }[]>(DEFAULT_ADVISORS)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [activeSection, setActiveSection] = useState<FinanceSection>('transacciones')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Modal para editar una venta por completo
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null)
  const [editPaidQty, setEditPaidQty] = useState<number>(0)
  const [editPendingQty, setEditPendingQty] = useState<number>(0)
  const [editPaymentStatus, setEditPaymentStatus] = useState<'pagado' | 'por_cobrar' | 'cortesia'>('por_cobrar')
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('')
  const [editPaymentReference, setEditPaymentReference] = useState<string>('')
  const [editCustomerName, setEditCustomerName] = useState<string>('')
  const [editAdvisorName, setEditAdvisorName] = useState<string>('')
  const [editProductId, setEditProductId] = useState<string>('')
  const [editInventoryId, setEditInventoryId] = useState<string>('')
  const [editInventoryOptions, setEditInventoryOptions] = useState<{ id: string; size_or_detail: string; stock: number }[]>([])
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false)
  const [isDeletingSale, setIsDeletingSale] = useState<boolean>(false)

  // Modales
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [advisorName, setAdvisorName] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState<boolean>(false)
  const [maintenanceAmount, setMaintenanceAmount] = useState<string>('')
  const [maintenanceRef, setMaintenanceRef] = useState<string>('')
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState<boolean>(false)

  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState<boolean>(false)
  const [selectedCommissionAdvisor, setSelectedCommissionAdvisor] = useState<string>(DEFAULT_ADVISORS[0]?.name || '')
  const [commissionAmount, setCommissionAmount] = useState<string>('')
  const [commissionRef, setCommissionRef] = useState<string>('')
  const [isSubmittingCommission, setIsSubmittingCommission] = useState<boolean>(false)

  // Cargar datos desde Supabase
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*, products(name, category, price, cost_price, profit_margin), inventory(size_or_detail)')
        .order('created_at', { ascending: false })

      if (salesError) throw salesError
      if (salesData) setSales(salesData as SaleRecord[])

      const { data: payData, error: payError } = await supabase
        .from('payment_records')
        .select('*')
        .order('created_at', { ascending: false })

      if (!payError && payData) {
        setPaymentRecords(payData)
      }

      const { data: advData, error: advError } = await supabase
        .from('advisors')
        .select('*')

      if (!advError && advData && advData.length > 0) {
        setAdvisors(advData)
      }

      const { data: prodData } = await supabase
        .from('products')
        .select('*, inventory(*)')
        .order('created_at', { ascending: false })

      if (prodData) setProducts(prodData as ProductItem[])

      const loadedSettings = await getSettings()
      setSettings(loadedSettings)
    } catch (error) {
      console.error('Error cargando datos financieros:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleOpenEditSale = (sale: SaleRecord) => {
    const totalQty = sale.quantity || 1
    const paid = sale.quantity_paid !== undefined ? sale.quantity_paid : (sale.payment_status === 'por_cobrar' ? 0 : totalQty)
    const pending = sale.quantity_pending !== undefined ? sale.quantity_pending : (sale.payment_status === 'por_cobrar' ? totalQty : 0)

    setEditingSale(sale)
    setEditPaidQty(paid)
    setEditPendingQty(pending)
    setEditPaymentStatus((sale.payment_status as any) || 'por_cobrar')
    setEditPaymentMethod(sale.payment_method || '')
    setEditPaymentReference(sale.payment_reference || '')
    setEditCustomerName(sale.customer_name || '')
    setEditAdvisorName(sale.advisor_name || '')
    setEditProductId(sale.product_id || '')
    setEditInventoryId(sale.inventory_id || '')

    // Cargar variantes de inventario del producto seleccionado
    if (sale.product_id) {
      loadInventoryForProduct(sale.product_id, sale.inventory_id || '')
    } else {
      setEditInventoryOptions([])
    }
  }

  const loadInventoryForProduct = async (productId: string, currentInventoryId?: string) => {
    try {
      const { data } = await supabase
        .from('inventory')
        .select('id, size_or_detail, stock')
        .eq('product_id', productId)
        .order('size_or_detail')

      if (data) {
        setEditInventoryOptions(data)
        // Si no hay invent_id válido, seleccionar el primero
        if (!currentInventoryId && data.length > 0) {
          setEditInventoryId(data[0].id)
        }
      }
    } catch {
      setEditInventoryOptions([])
    }
  }

  const handleSaveSaleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSale) return
    const totalQty = editingSale.quantity || 1

    if (editPaymentStatus !== 'cortesia' && editPaidQty + editPendingQty !== totalQty) {
      alert(`La suma de contado (${editPaidQty}) y pendiente (${editPendingQty}) debe ser exactamente igual a la cantidad total (${totalQty}).`)
      return
    }

    setIsSubmittingEdit(true)
    try {
      const isGift = editPaymentStatus === 'cortesia'
      const updateData: any = {
        payment_status: editPaymentStatus,
        payment_method: editPaymentMethod || null,
        payment_reference: editPaymentReference || null,
        customer_name: editCustomerName || 'Cliente General',
        advisor_name: editAdvisorName || 'General',
        quantity_paid: isGift ? 0 : editPaidQty,
        quantity_pending: isGift ? totalQty : editPendingQty,
        product_id: editProductId || null,
        inventory_id: editInventoryId || null,
      }

      const { error } = await supabase
        .from('sales')
        .update(updateData)
        .eq('id', editingSale.id)

      if (error) throw error

      setEditingSale(null)
      await fetchData()
    } catch (error) {
      console.error('Error actualizando venta:', error)
      alert('Error al actualizar.')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  const handleDeleteSale = async () => {
    if (!editingSale) return
    const ok = confirm(
      `¿Eliminar esta venta de forma permanente?\n\n` +
        `Producto: ${editingSale.products?.name || 'Ingreso Directo'}` +
        `${editingSale.inventory ? ` (Talla: ${editingSale.inventory.size_or_detail})` : ''}\n` +
        `Cliente: ${editingSale.customer_name || 'Cliente General'}\n` +
        `Monto: $${(Number(editingSale.total_price) || 0).toFixed(2)}\n\n` +
        `Esta acción no se puede deshacer.`
    )
    if (!ok) return

    setIsDeletingSale(true)
    try {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', editingSale.id)

      if (error) throw error

      setEditingSale(null)
      await fetchData()
    } catch (error) {
      console.error('Error eliminando venta:', error)
      alert('Error al eliminar la venta.')
    } finally {
      setIsDeletingSale(false)
    }
  }

  // Verificar un pago digital (Pago Móvil / Binance) contra la notificación bancaria real.
  // El admin compara: referencia del cliente + monto == lo que su banco le notificó.
  // Solo entonces marca la venta como pagada.
  const handleVerifyDigitalPayment = async (sale: SaleRecord) => {
    const amount = money(Number(sale.total_price) || 0)
    const ref = sale.payment_method || 'este pago'
    const ok = confirm(
      `¿Confirmas que recibiste el pago de ${amount} vía ${ref}?\n\n` +
        `Referencia del cliente: ${sale.payment_reference || '—'}\n\n` +
        `Verifica que coincida con la notificación de tu banco ANTES de aceptar.`
    )
    if (!ok) return

    const totalQty = sale.quantity || 1
    const { error } = await supabase
      .from('sales')
      .update({
        quantity_paid: totalQty,
        quantity_pending: 0,
        payment_status: 'pagado',
      })
      .eq('id', sale.id)

    if (error) {
      console.error('Error verificando pago:', error)
      alert('No se pudo marcar el pago como verificado.')
      return
    }

    await fetchData()
  }

  // Filtrado por fecha, pestañas y búsqueda
  const filteredSales = useMemo(() => {
    const now = new Date()

    return sales.filter((sale) => {
      const pending = sale.quantity_pending !== undefined ? sale.quantity_pending : (sale.payment_status === 'por_cobrar' ? (sale.quantity || 1) : 0)
      const isPending = pending > 0

      if (activeSection === 'cobrar' && !isPending) {
        return false
      }

      const saleDate = new Date(sale.created_at)

      let matchesTime = true
      if (timeRange === 'today') {
        matchesTime = saleDate.toDateString() === now.toDateString()
      } else if (timeRange === 'week') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        matchesTime = saleDate >= sevenDaysAgo
      } else if (timeRange === 'month') {
        matchesTime =
          saleDate.getMonth() === now.getMonth() &&
          saleDate.getFullYear() === now.getFullYear()
      }

      const matchesSearch =
        (sale.advisor_name &&
          sale.advisor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (sale.customer_name &&
          sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (sale.products?.name &&
          sale.products.name.toLowerCase().includes(searchTerm.toLowerCase()))

      return matchesTime && matchesSearch
    })
  }, [sales, timeRange, activeSection, searchTerm])

  const commissionRateFor = useCallback(
    (advisorName: string): number => {
      const advisor = advisors.find((a) => a.name === advisorName)
      if (advisor && advisor.commission_pct !== undefined && advisor.commission_pct !== null) {
        return Number(advisor.commission_pct) || 0
      }
      return settings.commissionPct
    },
    [advisors, settings.commissionPct]
  )

  const advisorCommissionsOwed = useMemo(() => {
    const map: Record<string, { totalSales: number; totalPaid: number; pending: number; rate: number }> = {}

    advisors.forEach((adv) => {
      map[adv.name] = { totalSales: 0, totalPaid: 0, pending: 0, rate: commissionRateFor(adv.name) }
    })

    sales.forEach((s) => {
      if (s.payment_status === 'cortesia') return
      const adv = s.advisor_name || 'General'
      if (!map[adv]) map[adv] = { totalSales: 0, totalPaid: 0, pending: 0, rate: commissionRateFor(adv) }
      map[adv].totalSales += Number(s.total_price) || 0
    })

    paymentRecords
      .filter((p) => p.type === 'comision')
      .forEach((p) => {
        const adv = p.advisor_name
        if (!map[adv]) map[adv] = { totalSales: 0, totalPaid: 0, pending: 0, rate: commissionRateFor(adv) }
        map[adv].totalPaid += Number(p.amount) || 0
      })

    Object.keys(map).forEach((adv) => {
      const earned = map[adv].totalSales * (map[adv].rate / 100)
      map[adv].pending = Math.max(0, earned - map[adv].totalPaid)
    })

    return map
  }, [advisors, sales, paymentRecords, commissionRateFor])

  const financialMetrics = useMemo(() => {
    let totalRevenue = 0
    let totalReceivables = 0
    let totalUnits = 0
    let baseRealProfit = 0
    let giftCount = 0

    sales.forEach((sale) => {
      const totalPrice = Number(sale.total_price) || 0
      const qty = Number(sale.quantity) || 1
      const unitPriceTotal = totalPrice / qty

      if (sale.payment_status === 'cortesia') {
        giftCount += 1
        return
      }

      const pendingQty = sale.quantity_pending !== undefined ? sale.quantity_pending : (sale.payment_status === 'por_cobrar' ? qty : 0)
      const pendingAmount = unitPriceTotal * pendingQty

      totalRevenue += totalPrice
      totalReceivables += pendingAmount
      totalUnits += qty

      if (sale.products) {
        const unitCost = Number(sale.products.cost_price) || 0
        const unitPrice = Number(sale.products.price) || unitPriceTotal
        const profitPerUnit = unitPrice - unitCost
        baseRealProfit += profitPerUnit * qty
      } else {
        baseRealProfit += totalPrice
      }
    })

    const totalPaidMaintenance = paymentRecords
      .filter((p) => p.type === 'mantenimiento')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

    const totalPaidCommissions = paymentRecords
      .filter((p) => p.type === 'comision')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

    const totalAppMaintenanceFee = totalRevenue * ((settings.maintenancePct || 0) / 100)
    const phantomMaintenancePending = Math.max(0, totalAppMaintenanceFee - totalPaidMaintenance)
    const netRealProfit = baseRealProfit - totalPaidMaintenance - totalPaidCommissions - totalReceivables

    let filteredRevenue = 0
    filteredSales.forEach((s) => {
      if (s.payment_status === 'cortesia') return
      filteredRevenue += Number(s.total_price) || 0
    })

    const totalTransactions = filteredSales.filter((s) => s.payment_status !== 'cortesia').length
    const averageTicket = totalTransactions > 0 ? filteredRevenue / totalTransactions : 0
    const profitMarginPercentage = totalRevenue > 0 ? (netRealProfit / totalRevenue) * 100 : 0

    return {
      totalRevenue: filteredRevenue,
      globalRevenue: totalRevenue,
      totalReceivables,
      totalUnits,
      totalTransactions,
      averageTicket,
      netRealProfit,
      profitMarginPercentage,
      appMaintenanceFee: totalAppMaintenanceFee,
      totalPaidMaintenance,
      totalPaidCommissions,
      phantomMaintenancePending,
      giftCount,
    }
  }, [sales, filteredSales, paymentRecords, settings.maintenancePct])

  const rentability = useMemo(() => {
    const byProduct = new Map<string, { name: string; units: number; revenue: number; profit: number }>()

    sales.forEach((s) => {
      if (s.payment_status === 'cortesia') return
      const key = s.product_id || 'directo'
      const name = s.products?.name || 'Ingreso Directo'
      const qty = Number(s.quantity) || 1
      const revenue = Number(s.total_price) || 0
      const unitCost = Number(s.products?.cost_price) || 0
      const unitPrice = Number(s.products?.price) || revenue / (qty || 1)
      const profit = (unitPrice - unitCost) * qty

      const current = byProduct.get(key) || { name, units: 0, revenue: 0, profit: 0 }
      current.units += qty
      current.revenue += revenue
      current.profit += profit
      byProduct.set(key, current)
    })

    const all = Array.from(byProduct.values())

    const inventoryCost = products.reduce((sum, p) => {
      const cost = Number(p.cost_price) || 0
      const units = (p.inventory || []).reduce((acc, i) => acc + (Number(i.stock) || 0), 0)
      return sum + cost * units
    }, 0)

    const inventoryRetail = products.reduce((sum, p) => {
      const price = Number(p.on_sale && p.discount_price ? p.discount_price : p.price) || 0
      const units = (p.inventory || []).reduce((acc, i) => acc + (Number(i.stock) || 0), 0)
      return sum + price * units
    }, 0)

    return {
      topByProfit: [...all].sort((a, b) => b.profit - a.profit).slice(0, 8),
      topByUnits: [...all].sort((a, b) => b.units - a.units).slice(0, 8),
      inventoryCost,
      inventoryRetail,
    }
  }, [sales, products])

  const weeklyRevenue = useMemo(() => {
    const weeks: { label: string; total: number }[] = []
    const now = new Date()

    for (let i = 7; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
      const total = sales
        .filter((s) => {
          if (s.payment_status === 'cortesia') return false
          const d = new Date(s.created_at)
          return d > start && d <= end
        })
        .reduce((sum, s) => sum + (Number(s.total_price) || 0), 0)

      weeks.push({
        label: end.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        total,
      })
    }

    return weeks
  }, [sales])

  const maxWeeklyRevenue = Math.max(...weeklyRevenue.map((w) => w.total), 1)

  const handleExportCsv = () => {
    const header = [
      'Fecha',
      'Producto',
      'Talla',
      'Cliente',
      'Asesor',
      'Metodo',
      'Estado',
      'Cantidad',
      'Contado',
      'Pendiente',
      'Total USD',
    ]

    const rows = filteredSales.map((s) => [
      new Date(s.created_at).toLocaleString('es-ES'),
      s.products?.name || 'Ingreso Directo',
      s.inventory?.size_or_detail || '',
      s.customer_name || 'Cliente General',
      s.advisor_name || 'General',
      s.payment_method || '',
      s.payment_status || '',
      s.quantity || 1,
      s.quantity_paid ?? '',
      s.quantity_pending ?? '',
      Number(s.total_price) || 0,
    ])

    exportCsv(`transacciones-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
  }

  const handleCreateDirectSale = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('sales').insert({
        advisor_name: advisorName || 'General',
        customer_name: 'Cliente General',
        unit_price: Number(amount),
        total_price: Number(amount),
        quantity: 1,
        quantity_paid: 1,
        quantity_pending: 0,
        payment_status: 'pagado',
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      setAmount('')
      setAdvisorName('')
      setIsModalOpen(false)
      await fetchData()
    } catch (error: any) {
      console.error('Error al registrar la transacción:', error)
      alert(`No se pudo registrar la transacción.${error?.message ? `\n${error.message}` : ''}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegisterMaintenancePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!maintenanceAmount || Number(maintenanceAmount) <= 0) return

    setIsSubmittingMaintenance(true)
    try {
      const { error } = await supabase.from('payment_records').insert({
        type: 'mantenimiento',
        advisor_name: settings.maintenanceOwner || 'Victor Diaz',
        amount: Number(maintenanceAmount),
        reference: maintenanceRef || 'N/A',
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      setMaintenanceAmount('')
      setMaintenanceRef('')
      setIsMaintenanceModalOpen(false)
      await fetchData()
    } catch (error) {
      console.error('Error registrando pago de mantenimiento:', error)
      alert('Error al registrar pago de mantenimiento')
    } finally {
      setIsSubmittingMaintenance(false)
    }
  }

  const handleRegisterCommissionPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commissionAmount || Number(commissionAmount) <= 0) return

    setIsSubmittingCommission(true)
    try {
      const { error } = await supabase.from('payment_records').insert({
        type: 'comision',
        advisor_name: selectedCommissionAdvisor,
        amount: Number(commissionAmount),
        reference: commissionRef || 'N/A',
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      setCommissionAmount('')
      setCommissionRef('')
      setIsCommissionModalOpen(false)
      await fetchData()
    } catch (error) {
      console.error('Error registrando pago de comisión:', error)
      alert('Error al registrar pago de comisión')
    } finally {
      setIsSubmittingCommission(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* CABECERA */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="ds-eyebrow">Control contable</p>
          <h1 className="ds-text-gold mt-1 text-3xl tracking-tight">Finanzas y Cuentas por Cobrar</h1>
          <p className="mt-1 text-xs font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
            Control contable, cuentas pendientes y pagos de comisiones / mantenimiento
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsCommissionModalOpen(true)}
            className="ds-btn-ghost px-4 py-3 text-xs uppercase tracking-widest"
          >
            <Award className="size-4 text-[#ef4444]" />
            Pago Comisión
          </button>

          <button
            onClick={() => setIsMaintenanceModalOpen(true)}
            className="ds-btn-ghost px-4 py-3 text-xs uppercase tracking-widest"
          >
            <Wrench className="size-4 text-[#ef4444]" />
            Pago Mantenimiento
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="ds-btn-gold px-5 py-3 text-xs uppercase tracking-widest"
          >
            <Plus className="size-4" />
            Registrar Ingreso
          </button>
        </div>
      </div>

      {/* MÉTRICAS CLAVE */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="ds-card ds-anim-in ds-stagger-1 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Ingresos Totales</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-[#ef4444]/20 bg-[#242428]">
              <DollarSign className="size-4 text-[#ef4444]" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-white">
            ${financialMetrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="mt-1 flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--ds-txt-3)' }}>
            <ArrowUpRight className="size-3 text-[#ef4444]" /> {financialMetrics.totalTransactions} transacciones
          </span>
        </div>

        <div className="ds-card ds-anim-in ds-stagger-2 rounded-xl p-5" style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)' }}>
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow" style={{ color: '#fbbf24' }}>Cuentas por Cobrar</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <Clock className="size-4 text-amber-400" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-amber-400">
            ${financialMetrics.totalReceivables.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <button
            onClick={() => setActiveSection(activeSection === 'cobrar' ? 'transacciones' : 'cobrar')}
            className="mt-1 block text-[10px] font-bold uppercase text-amber-500 hover:underline"
          >
            {activeSection === 'cobrar' ? 'Ver todas' : 'Ver pendientes →'}
          </button>
        </div>

        <div className="ds-card ds-anim-in ds-stagger-3 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Ganancia Neta</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-[#ef4444]/20 bg-[#242428]">
              <TrendingUp className="size-4 text-[#ef4444]" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-white">
            ${financialMetrics.netRealProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-[10px] font-bold" style={{ color: 'var(--ds-txt-3)' }}>
            Menos mant., comisiones y por cobrar
          </span>
        </div>

        <div className="ds-card ds-anim-in ds-stagger-4 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Mantenimiento Pend.</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10">
              <Wrench className="size-4 text-rose-400" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-rose-400">
            ${financialMetrics.phantomMaintenancePending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-[10px] font-bold" style={{ color: 'var(--ds-txt-3)' }}>
            Pagado: ${financialMetrics.totalPaidMaintenance.toFixed(2)}
          </span>
        </div>

        <div className="ds-card ds-anim-in ds-stagger-5 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Ticket Promedio</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-[#ef4444]/20 bg-[#242428]">
              <CreditCard className="size-4 text-[#ef4444]" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-white">
            ${financialMetrics.averageTicket.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-[10px] font-bold" style={{ color: 'var(--ds-txt-3)' }}>
            Promedio por venta
          </span>
        </div>
      </div>

      {/* PESTAÑAS Y FILTROS */}
      <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-1">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon
            const isActive = activeSection === sec.id
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-bold uppercase transition ${
                  isActive
                    ? sec.id === 'cobrar'
                      ? 'bg-amber-600 text-white'
                      : sec.id === 'comisiones'
                        ? 'bg-amber-500 text-black'
                        : sec.id === 'mantenimiento'
                          ? 'bg-rose-600 text-white'
                          : sec.id === 'rentabilidad'
                            ? 'bg-blue-600 text-white'
                            : 'bg-red-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Icon className="size-3.5" />
                {sec.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-1">
            {(['all', 'today', 'week', 'month'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition ${
                  timeRange === range ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                }`}
              >
                {range === 'all' ? 'Todo' : range === 'today' ? 'Hoy' : range === 'week' ? '7 días' : 'Mes'}
              </button>
            ))}
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar por cliente, asesor o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder-neutral-500 outline-none transition focus:border-emerald-500"
            />
          </div>

          {(activeSection === 'transacciones' || activeSection === 'cobrar') && (
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-[11px] font-bold uppercase text-neutral-300 transition hover:border-emerald-600 hover:text-white"
            >
              <Download className="size-4" /> Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* SECCIÓN: COMISIONES */}
      {activeSection === 'comisiones' && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/40">
            <div className="flex items-center justify-between border-b border-neutral-800 p-4">
              <h2 className="font-heading text-sm font-black uppercase tracking-widest text-neutral-200">
                Comisiones por Asesor
              </h2>
              <span className="text-[10px] font-bold uppercase text-neutral-500">
                Tasa global: {settings.commissionPct}%
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-800 bg-neutral-950/60 text-[10px] uppercase tracking-widest text-neutral-400">
                  <tr>
                    <th className="p-4">Asesor</th>
                    <th className="p-4 text-right">Ventas</th>
                    <th className="p-4 text-center">Tasa</th>
                    <th className="p-4 text-right">Comisión Ganada</th>
                    <th className="p-4 text-right">Pagado</th>
                    <th className="p-4 text-right">Saldo Pendiente</th>
                    <th className="p-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {Object.entries(advisorCommissionsOwed).map(([name, data]) => (
                    <tr key={name} className="transition-colors hover:bg-neutral-800/30">
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-bold uppercase text-white">
                          <User className="size-3 text-amber-400" />
                          {name}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono text-emerald-400">{money(data.totalSales)}</td>
                      <td className="p-4 text-center font-mono text-neutral-300">{data.rate}%</td>
                      <td className="p-4 text-right font-mono text-amber-300">
                        {money(data.totalSales * (data.rate / 100))}
                      </td>
                      <td className="p-4 text-right font-mono text-neutral-300">{money(data.totalPaid)}</td>
                      <td className="p-4 text-right font-mono font-black text-amber-400">{money(data.pending)}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedCommissionAdvisor(name)
                            setCommissionAmount(String(data.pending > 0 ? data.pending.toFixed(2) : ''))
                            setIsCommissionModalOpen(true)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600/20 border border-amber-500/30 px-3 py-1.5 text-[10px] font-black uppercase text-amber-300 transition hover:bg-amber-600/40"
                        >
                          <Wallet className="size-3.5" /> Pagar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/40">
            <div className="border-b border-neutral-800 p-4">
              <h2 className="font-heading text-sm font-black uppercase tracking-widest text-neutral-200">
                Historial de Pagos de Comisión
              </h2>
            </div>
            {paymentRecords.filter((p) => p.type === 'comision').length === 0 ? (
              <div className="p-8 text-center text-xs font-bold uppercase text-neutral-500">
                Aún no se han registrado pagos de comisión.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-neutral-800 bg-neutral-950/60 text-[10px] uppercase tracking-widest text-neutral-400">
                    <tr>
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Asesor</th>
                      <th className="p-4">Referencia</th>
                      <th className="p-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {paymentRecords
                      .filter((p) => p.type === 'comision')
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="p-4 font-mono text-xs text-neutral-400">
                            {new Date(p.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="p-4 font-bold uppercase text-white">{p.advisor_name}</td>
                          <td className="p-4 font-mono text-xs text-neutral-400">{p.reference}</td>
                          <td className="p-4 text-right font-mono font-black text-amber-400">{money(Number(p.amount))}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECCIÓN: MANTENIMIENTO */}
      {activeSection === 'mantenimiento' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">
                Cuota acumulada ({settings.maintenancePct}% de ingresos)
              </span>
              <p className="mt-2 font-mono text-2xl font-black text-rose-400">
                {money(financialMetrics.appMaintenanceFee)}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Pagado</span>
              <p className="mt-2 font-mono text-2xl font-black text-emerald-400">
                {money(financialMetrics.totalPaidMaintenance)}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Pendiente</span>
              <p className="mt-2 font-mono text-2xl font-black text-amber-400">
                {money(financialMetrics.phantomMaintenancePending)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/40">
            <div className="flex items-center justify-between border-b border-neutral-800 p-4">
              <h2 className="font-heading text-sm font-black uppercase tracking-widest text-neutral-200">
                Historial de Pagos de Mantenimiento
              </h2>
              <span className="text-[10px] font-bold uppercase text-neutral-500">
                Responsable: {settings.maintenanceOwner}
              </span>
            </div>
            {paymentRecords.filter((p) => p.type === 'mantenimiento').length === 0 ? (
              <div className="p-8 text-center text-xs font-bold uppercase text-neutral-500">
                Aún no se han registrado pagos de mantenimiento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-neutral-800 bg-neutral-950/60 text-[10px] uppercase tracking-widest text-neutral-400">
                    <tr>
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Responsable</th>
                      <th className="p-4">Referencia</th>
                      <th className="p-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {paymentRecords
                      .filter((p) => p.type === 'mantenimiento')
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="p-4 font-mono text-xs text-neutral-400">
                            {new Date(p.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="p-4 font-bold uppercase text-white">{p.advisor_name}</td>
                          <td className="p-4 font-mono text-xs text-neutral-400">{p.reference}</td>
                          <td className="p-4 text-right font-mono font-black text-rose-400">{money(Number(p.amount))}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECCIÓN: RENTABILIDAD */}
      {activeSection === 'rentabilidad' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Inventario al costo
              </span>
              <p className="mt-2 font-mono text-2xl font-black text-blue-400">{money(rentability.inventoryCost)}</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Inventario a precio de venta
              </span>
              <p className="mt-2 font-mono text-2xl font-black text-emerald-400">{money(rentability.inventoryRetail)}</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Ganancia bruta acumulada
              </span>
              <p className="mt-2 font-mono text-2xl font-black text-emerald-400">
                {money(financialMetrics.globalRevenue > 0 ? financialMetrics.netRealProfit + financialMetrics.totalPaidCommissions + financialMetrics.totalPaidMaintenance + financialMetrics.totalReceivables : 0)}
              </p>
            </div>
          </div>

          {/* GRÁFICO DE ÚLTIMOS 8 DÍAS */}
          <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="size-4 text-red-500" />
              <h2 className="font-heading text-sm font-black uppercase tracking-widest text-neutral-200">
                Ingresos de los últimos 8 días
              </h2>
            </div>
            <div className="flex h-40 items-end gap-2">
              {weeklyRevenue.map((day, idx) => {
                const height = Math.max(4, Math.round((day.total / maxWeeklyRevenue) * 100))
                return (
                  <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                    <span className="font-mono text-[9px] font-bold text-neutral-500">
                      {day.total > 0 ? `$${Math.round(day.total)}` : ''}
                    </span>
                    <div
                      className={`w-full rounded-t-md ${day.total > 0 ? 'bg-gradient-to-t from-red-700 to-red-500' : 'bg-neutral-800'}`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="font-mono text-[9px] text-neutral-500">{day.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/40">
              <div className="border-b border-neutral-800 p-4">
                <h2 className="font-heading text-sm font-black uppercase tracking-widest text-neutral-200">
                  Top productos por ganancia
                </h2>
              </div>
              {rentability.topByProfit.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold uppercase text-neutral-500">Sin datos todavía.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-neutral-800 bg-neutral-950/60 text-[10px] uppercase tracking-widest text-neutral-400">
                    <tr>
                      <th className="p-4">Producto</th>
                      <th className="p-4 text-right">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {rentability.topByProfit.map((p, idx) => (
                      <tr key={idx}>
                        <td className="p-4 font-bold uppercase text-white">{p.name}</td>
                        <td className="p-4 text-right font-mono font-black text-emerald-400">{money(p.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/40">
              <div className="border-b border-neutral-800 p-4">
                <h2 className="font-heading text-sm font-black uppercase tracking-widest text-neutral-200">
                  Top productos por unidades vendidas
                </h2>
              </div>
              {rentability.topByUnits.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold uppercase text-neutral-500">Sin datos todavía.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-neutral-800 bg-neutral-950/60 text-[10px] uppercase tracking-widest text-neutral-400">
                    <tr>
                      <th className="p-4">Producto</th>
                      <th className="p-4 text-center">Unidades</th>
                      <th className="p-4 text-right">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {rentability.topByUnits.map((p, idx) => (
                      <tr key={idx}>
                        <td className="p-4 font-bold uppercase text-white">{p.name}</td>
                        <td className="p-4 text-center font-mono text-sky-300">{p.units}</td>
                        <td className="p-4 text-right font-mono font-black text-emerald-400">{money(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECCIONES TABLAR: TRANSACCIONES / POR COBRAR */}
      {(activeSection === 'transacciones' || activeSection === 'cobrar') && (
      <div className="overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/40 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <h2 className="font-heading text-sm font-black uppercase tracking-widest text-neutral-200">
            {activeSection === 'cobrar' ? 'CUENTAS PENDIENTES POR COBRAR' : 'HISTORIAL DE TRANSACCIONES'} ({filteredSales.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs font-bold uppercase text-neutral-500">
            Cargando registros financieros...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-8 text-center text-xs font-bold uppercase text-neutral-500">
            No se encontraron transacciones en esta sección.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/60 text-[10px] uppercase tracking-widest text-neutral-400">
                <tr>
                  <th className="p-4">Fecha & Hora</th>
                  <th className="p-4">Cliente / Producto</th>
                  <th className="p-4">Asesor</th>
                  <th className="p-4">Método</th>
                  <th className="p-4 text-center">Desglose (Contado / Pend.)</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-right">Monto Total</th>
                  <th className="p-4 text-center">Acción Cobro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredSales.map((sale) => {
                  const totalQty = sale.quantity || 1
                  const paid = sale.quantity_paid ?? (sale.payment_status === 'por_cobrar' ? 0 : totalQty)
                  const pending = sale.quantity_pending ?? (sale.payment_status === 'por_cobrar' ? totalQty : 0)
                  const isPending = pending > 0
                  const isGift = sale.payment_status === 'cortesia'

                  return (
                    <tr key={sale.id} className="transition-colors hover:bg-neutral-800/30">
                      <td className="p-4 font-mono text-xs text-neutral-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-3 text-neutral-500" />
                          {new Date(sale.created_at).toLocaleString('es-ES', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="block font-bold uppercase text-white">
                          {sale.products?.name || 'Ingreso Directo'}
                        </span>
                        {sale.inventory && (
                          <span className="block text-[10px] font-bold uppercase text-red-400">
                            Talla: {sale.inventory.size_or_detail}
                          </span>
                        )}
                        <span className="block text-[10px] font-semibold text-neutral-400">
                          Cliente: <strong className="text-emerald-400 uppercase">{sale.customer_name || 'Cliente General'}</strong>
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-semibold text-neutral-300">
                          <User className="size-3 text-emerald-400" />
                          {sale.advisor_name || 'General'}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="block text-xs font-bold uppercase text-neutral-300">
                          {sale.payment_method || '—'}
                        </span>
                        {sale.payment_reference && (
                          <span className="mt-0.5 block font-mono text-[10px] text-neutral-500">
                            Ref: {sale.payment_reference}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center font-mono text-xs">
                        {isGift ? (
                          <span className="text-sky-400 font-bold">Sin cobro</span>
                        ) : (
                          <>
                            <span className="text-emerald-400 font-bold">{paid} Contado</span> / <span className="text-amber-400 font-bold">{pending} Pend.</span>
                          </>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                            isGift
                              ? 'bg-sky-500/10 border border-sky-500/30 text-sky-400'
                              : isPending
                                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                          }`}
                        >
                          {isGift ? 'Cortesía' : isPending ? 'Por Cobrar' : 'Cobrada'}
                        </span>
                      </td>
                      <td className={`p-4 text-right font-mono font-black ${isGift ? 'text-sky-400' : 'text-emerald-400'}`}>
                        {isGift ? '$0.00' : money(Number(sale.total_price) || 0)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          {/* Botón: verificar pago digital pendiente */}
                          {isPending &&
                            isDigitalPaymentPending(sale) && (
                            <button
                              onClick={() => handleVerifyDigitalPayment(sale)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 transition hover:bg-emerald-500/20"
                            >
                              <CheckCircle className="size-3.5" /> Verificar pago
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditSale(sale)}
                            disabled={isGift}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-800 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-40"
                          >
                            <Edit3 className="size-3.5" /> Editar Cobro
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* MODAL EDITAR VENTA COMPLETA */}
      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-heading text-lg font-black uppercase tracking-wider text-white">
                Editar Venta
              </h3>
              <button onClick={() => setEditingSale(null)} className="text-neutral-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-neutral-300 font-bold uppercase">
                {editingSale.products?.name || 'Ingreso Directo'}
                {editingSale.inventory && (
                  <span className="ml-2 text-red-400">Talla: {editingSale.inventory.size_or_detail}</span>
                )}
              </p>
              <p className="text-[10px] text-neutral-400 font-mono">
                Cantidad Total: <strong className="text-white">{editingSale.quantity || 1}</strong>
                {' | '}Monto: <strong className="text-emerald-400">${(Number(editingSale.total_price) || 0).toFixed(2)}</strong>
              </p>
            </div>

            <form onSubmit={handleSaveSaleEdit} className="space-y-4">
              {/* Producto (modelo) y Talla */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                    Producto / Modelo
                  </label>
                  <select
                    value={editProductId}
                    onChange={(e) => {
                      const pid = e.target.value
                      setEditProductId(pid)
                      setEditInventoryId('')
                      if (pid) {
                        loadInventoryForProduct(pid, '')
                      } else {
                        setEditInventoryOptions([])
                      }
                    }}
                    className="w-full cursor-pointer rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-red-500"
                  >
                    <option value="">— Ingreso Directo —</option>
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name}{prod.category ? ` (${prod.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                    Talla / Variante
                  </label>
                  <select
                    value={editInventoryId}
                    onChange={(e) => setEditInventoryId(e.target.value)}
                    disabled={!editProductId || editInventoryOptions.length === 0}
                    className="w-full cursor-pointer rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-red-500 disabled:opacity-40"
                  >
                    <option value="">
                      {editInventoryOptions.length === 0 ? '— Sin variantes —' : '— Seleccionar —'}
                    </option>
                    {editInventoryOptions.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.size_or_detail} (stock: {inv.stock})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cliente y Asesor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                    Cliente
                  </label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    placeholder="Cliente General"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white placeholder-neutral-600 outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                    Asesor
                  </label>
                  <select
                    value={editAdvisorName}
                    onChange={(e) => setEditAdvisorName(e.target.value)}
                    className="w-full cursor-pointer rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-red-500"
                  >
                    <option value="">General</option>
                    {advisors.map((adv) => (
                      <option key={adv.id} value={adv.name}>{adv.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Método de pago y referencia */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                    className="w-full cursor-pointer rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-red-500"
                  >
                    <option value="">—</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Pago Móvil">Pago Móvil</option>
                    <option value="Binance">Binance</option>
                    <option value="Zelle">Zelle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                    Referencia
                  </label>
                  <input
                    type="text"
                    value={editPaymentReference}
                    onChange={(e) => setEditPaymentReference(e.target.value)}
                    placeholder="N/A"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 font-mono text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Estado de pago */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">
                  Estado de Pago
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'pagado', label: 'Cobrada', color: 'emerald' },
                    { id: 'por_cobrar', label: 'Por Cobrar', color: 'amber' },
                    { id: 'cortesia', label: 'Cortesía', color: 'sky' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setEditPaymentStatus(opt.id)
                        if (opt.id === 'cortesia') {
                          setEditPaidQty(0)
                          setEditPendingQty(editingSale.quantity || 1)
                        } else if (opt.id === 'pagado') {
                          setEditPaidQty(editingSale.quantity || 1)
                          setEditPendingQty(0)
                        }
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-[11px] font-black uppercase tracking-wider transition ${
                        editPaymentStatus === opt.id
                          ? opt.color === 'emerald'
                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                            : opt.color === 'amber'
                              ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                              : 'border-sky-500/50 bg-sky-500/15 text-sky-400'
                          : 'border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Desglose contado/pendiente (solo si no es cortesía) */}
              {editPaymentStatus !== 'cortesia' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">
                      Unidades Contado
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={editingSale.quantity || 1}
                      value={editPaidQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        const max = editingSale.quantity || 1
                        const clamped = Math.max(0, Math.min(max, val))
                        setEditPaidQty(clamped)
                        setEditPendingQty(max - clamped)
                      }}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-sm font-bold text-emerald-400 outline-none focus:border-emerald-500 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">
                      Unidades Pendiente
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={editingSale.quantity || 1}
                      value={editPendingQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        const max = editingSale.quantity || 1
                        const clamped = Math.max(0, Math.min(max, val))
                        setEditPendingQty(clamped)
                        setEditPaidQty(max - clamped)
                      }}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-sm font-bold text-amber-400 outline-none focus:border-amber-500 text-center"
                    />
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDeleteSale}
                  disabled={isDeletingSale}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-heading text-xs font-black uppercase tracking-wider text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50"
                >
                  {isDeletingSale ? (
                    <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> Eliminando...</span>
                  ) : (
                    <span className="flex items-center gap-1.5"><Trash2 className="size-3.5" /> Eliminar</span>
                  )}
                </button>
                <div className="flex flex-1 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingSale(null)}
                    className="flex-1 rounded-xl border border-neutral-800 py-3 font-heading text-xs font-bold uppercase text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEdit}
                    className="flex-1 rounded-xl bg-red-600 py-3 font-heading text-xs font-black uppercase text-white hover:bg-red-700 transition disabled:opacity-50 shadow-lg shadow-red-600/35"
                  >
                    {isSubmittingEdit ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INGRESO DIRECTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-heading text-lg font-black uppercase tracking-wider text-white">
                Registrar Ingreso Manual
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDirectSale} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                  Monto ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-sm font-bold text-emerald-400 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                  Nombre del Asesor / Responsable
                </label>
                <input
                  type="text"
                  placeholder="Ej: Angel Serrano"
                  value={advisorName}
                  onChange={(e) => setAdvisorName(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs text-white outline-none focus:border-emerald-500"
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
                  className="w-1/2 rounded-xl bg-emerald-600 py-3 font-heading text-xs font-black uppercase text-white hover:bg-emerald-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/35"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PAGO DE MANTENIMIENTO */}
      {isMaintenanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-heading text-lg font-black uppercase tracking-wider text-white">
                Registrar Pago de Mantenimiento
              </h3>
              <button onClick={() => setIsMaintenanceModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="text-xs text-neutral-400 space-y-1">
              <p>
                Mantenimiento pendiente:{' '}
                <strong className="text-rose-400 font-mono">${financialMetrics.phantomMaintenancePending.toFixed(2)}</strong>
              </p>
              <p className="text-[10px] text-neutral-500 uppercase font-bold">
                Responsable asignado: {settings.maintenanceOwner}
              </p>
            </div>

            <form onSubmit={handleRegisterMaintenancePayment} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                  Monto Pagado ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={maintenanceAmount}
                  onChange={(e) => setMaintenanceAmount(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-sm font-bold text-rose-400 outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                  Número de Referencia / Comprobante
                </label>
                <input
                  type="text"
                  placeholder="Ej: REF-12345678"
                  value={maintenanceRef}
                  onChange={(e) => setMaintenanceRef(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs text-white outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsMaintenanceModalOpen(false)}
                  className="w-1/2 rounded-xl border border-neutral-800 py-3 font-heading text-xs font-bold uppercase text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMaintenance}
                  className="w-1/2 rounded-xl bg-rose-600 py-3 font-heading text-xs font-black uppercase text-white hover:bg-rose-700 transition disabled:opacity-50 shadow-lg shadow-rose-600/35"
                >
                  {isSubmittingMaintenance ? 'Registrando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PAGO DE COMISIÓN */}
      {isCommissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-heading text-lg font-black uppercase tracking-wider text-white">
                Registrar Pago de Comisión
              </h3>
              <button onClick={() => setIsCommissionModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                  Seleccionar Asesor
                </label>
                <select
                  value={selectedCommissionAdvisor}
                  onChange={(e) => setSelectedCommissionAdvisor(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs font-bold uppercase text-white outline-none focus:border-amber-500"
                >
                  {advisors.map((adv) => (
                    <option key={adv.id || adv.name} value={adv.name}>
                      {adv.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-xs space-y-1">
                <span className="text-neutral-400 uppercase font-bold text-[10px]">
                  Comisión Pendiente por Pagar (tasa {commissionRateFor(selectedCommissionAdvisor)}%):
                </span>
                <p className="font-mono text-lg font-black text-amber-400">
                  ${(advisorCommissionsOwed[selectedCommissionAdvisor]?.pending || 0).toFixed(2)}
                </p>
              </div>

              <form onSubmit={handleRegisterCommissionPayment} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                    Monto a Pagar ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={commissionAmount}
                    onChange={(e) => setCommissionAmount(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-sm font-black text-amber-400 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                    Número de Referencia / Comprobante
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: REF-98765432"
                    value={commissionRef}
                    onChange={(e) => setCommissionRef(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCommissionModalOpen(false)}
                    className="w-1/2 rounded-xl border border-neutral-800 py-3 font-heading text-xs font-bold uppercase text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCommission}
                    className="w-1/2 rounded-xl bg-amber-600 py-3 font-heading text-xs font-black uppercase text-white hover:bg-amber-700 transition disabled:opacity-50 shadow-lg shadow-amber-600/35"
                  >
                    {isSubmittingCommission ? 'Registrando...' : 'Confirmar Pago'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
