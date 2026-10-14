'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  DollarSign,
  UserCheck,
  User,
  HandCoins,
  Gift,
  Clock,
  Coins
} from 'lucide-react'
import Image from 'next/image'
import { ProductItem, InventoryVariant } from '@/lib/types'
import { ADVISORS as DEFAULT_ADVISORS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { processSale, SettlementType } from '@/lib/sales'
import { getSettings, AppSettings, DEFAULT_SETTINGS } from '@/lib/settings'
import { validateCoupon, computeCouponDiscount, describeCoupon, CouponRecord } from '@/lib/coupons'

const supabase = createClient()

const PAYMENT_METHODS = [
  { id: 'Efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'Pago Móvil', label: 'Pago Móvil', icon: Smartphone },
  { id: 'Zelle', label: 'Zelle', icon: CreditCard },
  { id: 'Binance', label: 'Binance', icon: DollarSign },
]

const SETTLEMENT_OPTIONS: { id: SettlementType; label: string; icon: any; hint: string }[] = [
  { id: 'pagado', label: 'Contado', icon: Banknote, hint: 'Cobrado al momento' },
  { id: 'por_cobrar', label: 'Por Cobrar', icon: Clock, hint: 'Queda pendiente' },
  { id: 'cortesia', label: 'Cortesía', icon: Gift, hint: 'No se cobra' },
]

interface CartItem {
  product: ProductItem
  variant: InventoryVariant
  quantity: number
  quantityPaid: number
  quantityPending: number
  unitPrice: number
}

export default function POSPage() {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [advisors, setAdvisors] = useState<{ id: string; name: string }[]>(DEFAULT_ADVISORS)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Carrito y datos de factura
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedAdvisor, setSelectedAdvisor] = useState<string>(DEFAULT_ADVISORS[0]?.name || '')
  const [customerName, setCustomerName] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo')
  const [paymentReference, setPaymentReference] = useState<string>('')
  const [settlement, setSettlement] = useState<SettlementType>('pagado')
  const [tip, setTip] = useState<string>('')
  const [customTotal, setCustomTotal] = useState<string>('')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [lastCompletedSale, setLastCompletedSale] = useState<any>(null)
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false)

  // Cupón autorizado
  const [couponInput, setCouponInput] = useState<string>('')
  const [appliedCoupon, setAppliedCoupon] = useState<CouponRecord | null>(null)
  const [couponError, setCouponError] = useState<string>('')
  const [isApplyingCoupon, setIsApplyingCoupon] = useState<boolean>(false)

  // Modal talla
  const [activeProductForVariant, setActiveProductForVariant] = useState<ProductItem | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select('*, inventory(*)')
        .order('created_at', { ascending: false })

      if (prodError) throw prodError
      if (prodData) setProducts(prodData as ProductItem[])

      const { data: advData, error: advError } = await supabase
        .from('advisors')
        .select('*')

      if (!advError && advData && advData.length > 0) {
        setAdvisors(advData)
        setSelectedAdvisor(advData[0].name)
      }

      const loadedSettings = await getSettings()
      setSettings(loadedSettings)
    } catch (error) {
      console.error('Error cargando datos POS:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  const handleAddToCart = (product: ProductItem, variant: InventoryVariant) => {
    if (variant.stock <= 0) return

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.variant.id === variant.id
      )

      if (existingIndex > -1) {
        const updated = [...prev]
        const currentQty = updated[existingIndex].quantity
        if (currentQty < variant.stock) {
          updated[existingIndex].quantity += 1
          updated[existingIndex].quantityPaid += 1
        }
        return updated
      } else {
        const defaultPrice = Number(product.price) || 0
        return [
          ...prev,
          { product, variant, quantity: 1, quantityPaid: 1, quantityPending: 0, unitPrice: defaultPrice },
        ]
      }
    })
    setActiveProductForVariant(null)
  }

  const handleUpdateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev]
      const item = updated[index]
      const newQty = item.quantity + delta

      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index)
      } else if (newQty <= item.variant.stock) {
        item.quantity = newQty
        item.quantityPaid = newQty
        item.quantityPending = 0
      }
      return updated
    })
  }

  const handleSplitChange = (index: number, paid: number) => {
    setCart((prev) => {
      const updated = [...prev]
      const item = updated[index]
      const clampedPaid = Math.max(0, Math.min(item.quantity, paid))
      item.quantityPaid = clampedPaid
      item.quantityPending = item.quantity - clampedPaid
      return updated
    })
  }

  const handleRemoveCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUnitPriceChange = (index: number, price: number) => {
    setCart((prev) => {
      const updated = [...prev]
      updated[index].unitPrice = Math.max(0, price)
      return updated
    })
  }

  const calculatedSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * item.quantity, 0)
  }, [cart])

  const tipAmount = Math.max(0, Number(tip) || 0)

  const couponDiscount = useMemo(() => {
    if (!appliedCoupon || settlement === 'cortesia') return 0
    const base = customTotal !== '' ? Number(customTotal) || 0 : calculatedSubtotal
    return computeCouponDiscount(appliedCoupon, base)
  }, [appliedCoupon, customTotal, calculatedSubtotal, settlement])

  const finalAmountToPay = useMemo(() => {
    const base = customTotal !== '' ? Number(customTotal) || 0 : calculatedSubtotal
    if (settlement === 'cortesia') return 0
    return Math.max(0, base - couponDiscount) + tipAmount
  }, [customTotal, calculatedSubtotal, settlement, tipAmount, couponDiscount])

  const totalInBs = finalAmountToPay * (settings.exchangeRate || 1)

  const REFERENCE_REQUIRED_METHODS = ['Pago Móvil', 'Zelle', 'Binance']
  const needsReference =
    REFERENCE_REQUIRED_METHODS.includes(paymentMethod) && settlement === 'pagado'

  const handleApplyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) return

    setIsApplyingCoupon(true)
    setCouponError('')

    try {
      const result = await validateCoupon(code, customerName.trim() || undefined)
      if (!result.ok || !result.coupon) {
        setCouponError(result.error || 'Cupón no válido.')
        setAppliedCoupon(null)
        return
      }
      setAppliedCoupon(result.coupon)
      setCouponInput(result.coupon.code)
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError('')
  }

  const handleProcessSale = async () => {
    if (cart.length === 0) return

    if (needsReference && !paymentReference.trim()) {
      alert(
        `El método de pago "${paymentMethod}" requiere el número de referencia de la transacción para cerrar la venta.`
      )
      return
    }

    setIsProcessing(true)

    try {
      const finalCustomer = customerName.trim() || 'Cliente General'

      for (const item of cart) {
        if (!item.variant.id) {
          throw new Error(`La variante de "${item.product.name}" no tiene identificador de inventario.`)
        }
      }

      const items = cart.map((item) => {
        const unitPrice = Number(item.unitPrice) || 0
        const isCortesia = settlement === 'cortesia'
        const quantityPaid = isCortesia ? 0 : item.quantityPaid
        const quantityPending = isCortesia ? 0 : item.quantityPending

        return {
          product_id: item.product.id,
          inventory_id: item.variant.id as string,
          unit_price: unitPrice,
          total_price: unitPrice * item.quantity,
          quantity: item.quantity,
          quantity_paid: quantityPaid,
          quantity_pending: quantityPending,
        }
      })

      const result = await processSale({
        items,
        advisor: selectedAdvisor || 'General',
        customer: finalCustomer,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        customTotal: settlement === 'cortesia' ? 0 : (customTotal !== '' ? Number(customTotal) || 0 : null),
        tip: settlement === 'cortesia' ? 0 : tipAmount,
        settlement,
        couponCode: appliedCoupon && settlement !== 'cortesia' ? appliedCoupon.code : undefined,
        couponDiscount: settlement !== 'cortesia' ? couponDiscount : 0,
      })

      const completedSaleData = {
        id: (result.saleRef || Math.random().toString(36).substring(7)).toUpperCase().slice(0, 12),
        date: new Date().toLocaleString('es-ES'),
        advisor: selectedAdvisor,
        customer: finalCustomer,
        paymentMethod,
        paymentReference: paymentReference.trim() || null,
        settlement,
        tip: settlement === 'cortesia' ? 0 : tipAmount,
        items: [...cart],
        subtotal: calculatedSubtotal,
        total: finalAmountToPay,
        totalBs: totalInBs,
        exchangeRate: settings.exchangeRate || 1,
        mode: result.mode,
        couponCode: appliedCoupon && settlement !== 'cortesia' ? appliedCoupon.code : null,
        couponDiscount: settlement !== 'cortesia' ? couponDiscount : 0,
      }

      setLastCompletedSale(completedSaleData)
      setShowReceiptModal(true)
      setCart([])
      setCustomTotal('')
      setCustomerName('')
      setTip('')
      setPaymentReference('')
      setSettlement('pagado')
      handleRemoveCoupon()
      await fetchData()
    } catch (error: any) {
      console.error('Error procesando venta POS:', error)
      alert(`Ocurrió un error al procesar la venta.${error?.message ? `\n${error.message}` : ''}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
      {/* COLUMNA IZQUIERDA: CATÁLOGO */}
      <div className="lg:col-span-7 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="ds-eyebrow">Punto de venta</p>
            <h1 className="ds-text-gold mt-1 text-2xl tracking-tight sm:text-3xl">POS — Cobro Rápido</h1>
            <p className="mt-1 text-xs font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
              Selecciona productos para agregar al carrito
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder-neutral-500 outline-none focus:border-red-600 transition"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-xs font-bold uppercase text-neutral-300 outline-none focus:border-red-600 transition"
          >
            <option value="all">Todas las Categorías</option>
            <option value="zapatillas">Zapatillas</option>
            <option value="perfumes">Perfumes</option>
            <option value="accesorios">Accesorios</option>
          </select>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs font-bold uppercase text-neutral-500">
            Cargando catálogo POS...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-xs font-bold uppercase text-neutral-500">
            No se encontraron productos disponibles.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[650px] overflow-y-auto pr-2">
            {filteredProducts.map((product) => {
              const totalStock = product.inventory?.reduce((acc, i) => acc + (i.stock || 0), 0) || 0
              const isOutOfStock = totalStock <= 0

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && setActiveProductForVariant(product)}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-neutral-900/40 p-3 backdrop-blur-md transition-all ${
                    isOutOfStock
                      ? 'border-neutral-800 opacity-40 cursor-not-allowed'
                      : 'border-neutral-800 hover:border-red-600 cursor-pointer hover:bg-neutral-900/80 hover:shadow-lg hover:shadow-red-950/20 active:scale-[0.98]'
                  }`}
                >
                  <div>
                    <div className="relative h-32 w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 mb-3">
                      <Image
                        src={product.image || '/placeholder.png'}
                        alt={product.name}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="font-heading text-[10px] font-black uppercase text-red-500 bg-black/80 px-2 py-1 rounded">
                            Agotado
                          </span>
                        </div>
                      )}
                    </div>

                    <h4 className="font-heading text-xs font-black uppercase tracking-wide text-white line-clamp-1">
                      {product.name}
                    </h4>
                    <p className="text-[10px] uppercase text-neutral-400 font-semibold">
                      {product.category}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-neutral-800/80">
                    <span className="font-mono text-sm font-black text-emerald-400">
                      ${product.price}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-neutral-400">
                      Stock: {totalStock}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* COLUMNA DERECHA: CARRITO Y DATOS DE CLIENTE */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur-md flex flex-col justify-between min-h-[650px] shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-5 text-red-500" />
                <h3 className="font-heading text-base font-black uppercase tracking-wider text-white">
                  Factura Actual
                </h3>
              </div>
              <span className="rounded-full bg-red-600/20 border border-red-500/30 px-2.5 py-0.5 font-mono text-xs font-bold text-red-400">
                {cart.reduce((sum, i) => sum + i.quantity, 0)} ítems
              </span>
            </div>

            {/* NOMBRE DEL CLIENTE */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                <User className="size-3.5 text-red-500" /> Nombre del Cliente (Obligatorio o Crédito)
              </label>
              <input
                type="text"
                placeholder="Ej. Juan Pérez / Empresa C.A."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-xs font-semibold text-white placeholder-neutral-500 outline-none focus:border-red-600 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                <UserCheck className="size-3.5 text-red-500" /> Asesor Responsable
              </label>
              <select
                value={selectedAdvisor}
                onChange={(e) => setSelectedAdvisor(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-xs font-bold uppercase text-white outline-none focus:border-red-600 transition"
              >
                {advisors.map((adv) => (
                  <option key={adv.id || adv.name} value={adv.name}>
                    {adv.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Método de Pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon
                  const active = paymentMethod === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-xs font-bold uppercase transition ${
                        active
                          ? 'border-[#ef4444]/60 bg-[#ef4444]/15 text-white shadow-sm'
                          : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white'
                      }`}
                    >
                      <Icon className={`size-4 ${active ? 'text-[#ef4444]' : 'text-white/40'}`} />
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {needsReference && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                  <CreditCard className="size-3.5 text-amber-400" /> Número de Referencia ({paymentMethod}) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 123456789 o hash de la transacción"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/40 bg-neutral-950 px-3.5 py-2.5 font-mono text-xs font-bold text-amber-400 placeholder-neutral-600 outline-none focus:border-amber-500 transition"
                />
                <p className="text-[9px] font-bold uppercase text-amber-500/70">
                  Obligatorio: sin referencia no se puede cerrar la venta con {paymentMethod}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Tipo de Liquidación
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SETTLEMENT_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const active = settlement === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSettlement(opt.id)}
                      title={opt.hint}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[10px] font-black uppercase transition ${
                        active
                          ? opt.id === 'por_cobrar'
                            ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                            : opt.id === 'cortesia'
                              ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                              : 'border-[#ef4444] bg-[#ef4444]/15 text-[#fca5a5]'
                          : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white'
                      }`}
                    >
                      <Icon className="size-4" />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {settlement === 'cortesia' && (
                <p className="text-[10px] font-bold uppercase text-sky-400">
                  Venta sin cobro: se registra el movimiento de mercancía pero el total es $0.00
                </p>
              )}
            </div>

            {settlement !== 'cortesia' && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  <HandCoins className="size-3.5 text-emerald-500" /> Propina (opcional, USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 font-mono text-xs font-bold text-emerald-400 placeholder-neutral-600 outline-none focus:border-emerald-500 transition"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Productos en Carrito
              </label>
              <div className="max-h-48 overflow-y-auto space-y-3 pr-1">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-xs font-bold uppercase text-neutral-500">
                    El carrito está vacío. Haz clic en un producto para agregarlo.
                  </div>
                ) : (
                  cart.map((item, idx) => {
                    const itemTotal = (Number(item.unitPrice) || 0) * item.quantity
                    const hasMultiple = item.quantity >= 2

                    return (
                      <div
                        key={`${item.product.id}-${item.variant.id}-${idx}`}
                        className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="pr-2">
                            <h5 className="font-bold text-xs uppercase text-white line-clamp-1">
                              {item.product.name}
                            </h5>
                            <span className="font-mono text-[10px] text-neutral-400">
                              Talla: <strong className="text-red-400">{item.variant.size_or_detail}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
                              <button
                                onClick={() => handleUpdateQuantity(idx, -1)}
                                className="p-1 text-neutral-400 hover:text-white"
                              >
                                <Minus className="size-3" />
                              </button>
                              <span className="font-mono text-xs font-bold px-1.5 text-white">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleUpdateQuantity(idx, 1)}
                                className="p-1 text-neutral-400 hover:text-white"
                              >
                                <Plus className="size-3" />
                              </button>
                            </div>

                            <div className="flex flex-col items-end gap-0.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => handleUnitPriceChange(idx, parseFloat(e.target.value) || 0)}
                                className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-right font-mono text-xs font-bold text-emerald-400 outline-none focus:border-emerald-500"
                                title="Precio unitario (editable)"
                              />
                              <span className="font-mono text-[10px] font-black text-emerald-400 w-20 text-right">
                                = ${itemTotal.toFixed(2)}
                              </span>
                            </div>

                            <button
                              onClick={() => handleRemoveCartItem(idx)}
                              className="p-1 text-neutral-500 hover:text-red-500 transition"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>

                        {hasMultiple && (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-950/10 p-2 space-y-1">
                            <span className="text-[10px] font-black uppercase text-amber-400 block">
                              Desglose de Pago (Total: {item.quantity})
                            </span>
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-1">
                                <span className="text-neutral-400 text-[10px]">Contado:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={item.quantity}
                                  value={item.quantityPaid}
                                  onChange={(e) => handleSplitChange(idx, parseInt(e.target.value) || 0)}
                                  className="w-12 rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-center font-mono font-bold text-emerald-400 text-xs"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-neutral-400 text-[10px]">Pendiente:</span>
                                <strong className="font-mono text-amber-400">{item.quantityPending}</strong>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* CUPÓN AUTORIZADO */}
          {settlement !== 'cortesia' && (
            <div className="rounded-2xl border border-white/[0.06] bg-[#16161a] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="ds-eyebrow">Cupón autorizado</span>
                {appliedCoupon && (
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-[10px] font-bold uppercase text-neutral-400 hover:text-red-400 transition"
                  >
                    Quitar
                  </button>
                )}
              </div>

              {appliedCoupon ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/[0.06] px-3 py-2">
                  <div className="min-w-0">
                    <span className="block font-mono text-xs font-black uppercase text-[#ef4444]">
                      {appliedCoupon.code}
                    </span>
                    <span className="block text-[10px] font-semibold" style={{ color: 'var(--ds-txt-3)' }}>
                      {describeCoupon(appliedCoupon)}
                      {appliedCoupon.customer_name ? ` • ${appliedCoupon.customer_name}` : ''}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-black text-[#ef4444]">
                    -${couponDiscount.toFixed(2)}
                  </span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Código (ej. FIJO10)"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase())
                      setCouponError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleApplyCoupon()
                      }
                    }}
                    className="ds-input flex-1 py-2 font-mono text-xs uppercase"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={isApplyingCoupon || !couponInput.trim()}
                    className="ds-btn-ghost px-4 py-2 text-[10px] uppercase tracking-widest disabled:opacity-40"
                  >
                    {isApplyingCoupon ? '...' : 'Aplicar'}
                  </button>
                </div>
              )}

              {couponError && (
                <p className="text-[10px] font-bold text-red-400">{couponError}</p>
              )}
            </div>
          )}

          <div className="space-y-4 pt-4 border-t border-neutral-800">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-neutral-400">
                <span>Subtotal Calculado:</span>
                <span className="font-mono text-white">${calculatedSubtotal.toFixed(2)}</span>
              </div>

              {couponDiscount > 0 && settlement !== 'cortesia' && (
                <div className="flex justify-between text-xs font-bold text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Gift className="size-3 text-[#ef4444]" /> Cupón {appliedCoupon?.code}:
                  </span>
                  <span className="font-mono text-[#ef4444]">-${couponDiscount.toFixed(2)}</span>
                </div>
              )}

              {tipAmount > 0 && settlement !== 'cortesia' && (
                <div className="flex justify-between text-xs font-bold text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Coins className="size-3 text-emerald-500" /> Propina:
                  </span>
                  <span className="font-mono text-emerald-400">+${tipAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-black uppercase text-white">
                  {settlement === 'cortesia' ? 'Total (Cortesía):' : 'Monto Total ($):'}
                </span>
                {settlement === 'cortesia' ? (
                  <span className="font-mono text-lg font-black text-sky-400">$0.00</span>
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    value={customTotal}
                    placeholder={calculatedSubtotal.toFixed(2)}
                    onChange={(e) => setCustomTotal(e.target.value)}
                    className="w-32 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-1.5 font-mono text-sm font-black text-emerald-400 text-right outline-none focus:border-red-600"
                  />
                )}
              </div>

              {settings.exchangeRate > 1 && (
                <div className="flex justify-between text-[10px] font-bold uppercase text-neutral-500">
                  <span>Equivalente Bs. (tasa {settings.exchangeRate}):</span>
                  <span className="font-mono text-amber-400">
                    {totalInBs.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={handleProcessSale}
              disabled={cart.length === 0 || isProcessing || (needsReference && !paymentReference.trim())}
              className={`w-full rounded-2xl py-4 font-heading text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 ${
                settlement === 'cortesia'
                  ? 'bg-sky-600 text-white shadow-sky-600/30 hover:bg-sky-700'
                  : settlement === 'por_cobrar'
                    ? 'bg-amber-600 text-white shadow-amber-600/30 hover:bg-amber-700'
                    : 'ds-btn-gold py-4 text-xs uppercase tracking-widest'
              }`}
            >
              {isProcessing
                ? 'Procesando Venta...'
                : settlement === 'cortesia'
                  ? 'Registrar como Cortesía'
                  : settlement === 'por_cobrar'
                    ? 'Dejar por Cobrar'
                    : 'Completar Venta y Cobrar'}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL TALLA */}
      {activeProductForVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-[#0c0c0e] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-heading text-sm font-black uppercase tracking-wider text-white">
                Selecciona Talla / Variante
              </h3>
              <button
                onClick={() => setActiveProductForVariant(null)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400 font-medium">
              Producto: <strong className="text-white">{activeProductForVariant.name}</strong>
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activeProductForVariant.inventory?.filter((i) => i.stock > 0).length === 0 ? (
                <p className="p-4 text-center text-xs italic text-neutral-500">
                  No hay stock disponible para este producto.
                </p>
              ) : (
                activeProductForVariant.inventory
                  ?.filter((i) => i.stock > 0)
                  .map((inv) => (
                    <button
                      key={inv.id || inv.size_or_detail}
                      onClick={() => handleAddToCart(activeProductForVariant, inv)}
                      className="w-full flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 transition hover:border-red-600 hover:bg-neutral-900 group"
                    >
                      <span className="font-mono text-xs font-bold uppercase text-white">
                        Talla / Detalle: {inv.size_or_detail}
                      </span>
                      <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2.5 py-1 rounded-lg">
                        Stock: {inv.stock} uds
                      </span>
                    </button>
                  ))
              )}
            </div>

            <button
              onClick={() => setActiveProductForVariant(null)}
              className="w-full rounded-xl border border-neutral-800 py-3 text-xs font-bold uppercase text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL RECIBO */}
      {showReceiptModal && lastCompletedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-auto w-full max-w-lg rounded-3xl border border-neutral-800 bg-white p-8 text-neutral-900 shadow-2xl space-y-6">
            <div id="printable-receipt" className="space-y-6">
              <div className="text-center border-b border-neutral-200 pb-4 space-y-1">
                <div className="inline-block px-3 py-1 bg-red-600 text-white font-black text-sm uppercase rounded-lg mb-1">
                  REALITY SHOP
                </div>
                <h2 className="text-xl font-black uppercase tracking-wider text-black">
                  Comprobante de Venta
                </h2>
                <p className="text-xs text-neutral-500 font-mono">Factura ID: #{lastCompletedSale.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-neutral-500 uppercase text-[10px] font-bold">Cliente:</span>
                  <strong className="text-black uppercase">{lastCompletedSale.customer}</strong>
                </div>
                <div>
                  <span className="block text-neutral-500 uppercase text-[10px] font-bold">Fecha y Hora:</span>
                  <strong className="font-mono text-black">{lastCompletedSale.date}</strong>
                </div>
                <div>
                  <span className="block text-neutral-500 uppercase text-[10px] font-bold">Asesor de Venta:</span>
                  <strong className="text-black">{lastCompletedSale.advisor}</strong>
                </div>
                <div>
                  <span className="block text-neutral-500 uppercase text-[10px] font-bold">Método de Pago:</span>
                  <strong className="text-black">{lastCompletedSale.paymentMethod}</strong>
                </div>
                {lastCompletedSale.paymentReference && (
                  <div>
                    <span className="block text-neutral-500 uppercase text-[10px] font-bold">Referencia:</span>
                    <strong className="font-mono text-black">{lastCompletedSale.paymentReference}</strong>
                  </div>
                )}
                <div>
                  <span className="block text-neutral-500 uppercase text-[10px] font-bold">Liquidación:</span>
                  <strong className="text-black uppercase">
                    {lastCompletedSale.settlement === 'cortesia'
                      ? 'Cortesía'
                      : lastCompletedSale.settlement === 'por_cobrar'
                        ? 'Por Cobrar'
                        : 'Contado'}
                  </strong>
                </div>
                {Number(lastCompletedSale.tip) > 0 && (
                  <div>
                    <span className="block text-neutral-500 uppercase text-[10px] font-bold">Propina:</span>
                    <strong className="font-mono text-black">${Number(lastCompletedSale.tip).toFixed(2)}</strong>
                  </div>
                )}
                {lastCompletedSale.couponCode && Number(lastCompletedSale.couponDiscount) > 0 && (
                  <div>
                    <span className="block text-neutral-500 uppercase text-[10px] font-bold">Cupón aplicado:</span>
                    <strong className="font-mono text-black">
                      {lastCompletedSale.couponCode} (-${Number(lastCompletedSale.couponDiscount).toFixed(2)})
                    </strong>
                  </div>
                )}
              </div>

              <div className="border-t border-b border-neutral-200 py-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500 text-[10px] uppercase font-bold">
                      <th className="pb-2 text-left">Producto</th>
                      <th className="pb-2 text-center">Talla</th>
                      <th className="pb-2 text-center">Cant</th>
                      <th className="pb-2 text-right">Precio U.</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {lastCompletedSale.items.map((item: any, idx: number) => {
                      const unitPrice = Number(item.unitPrice ?? item.product?.price) || 0
                      const itemTot = unitPrice * item.quantity
                      return (
                        <tr key={idx} className="font-mono">
                          <td className="py-2.5 font-bold uppercase text-black">{item.product.name}</td>
                          <td className="py-2.5 text-center">{item.variant.size_or_detail}</td>
                          <td className="py-2.5 text-center">{item.quantity} (Contado: {item.quantityPaid}, Pend: {item.quantityPending})</td>
                          <td className="py-2.5 text-right">${unitPrice.toFixed(2)}</td>
                          <td className="py-2.5 text-right font-black">${itemTot.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-black uppercase text-black">Monto Total Factura:</span>
                  <span className="text-xl font-mono font-black text-red-600">
                    ${Number(lastCompletedSale.total).toFixed(2)}
                  </span>
                </div>
                {Number(lastCompletedSale.totalBs) > 0 && Number(lastCompletedSale.exchangeRate) > 1 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase text-neutral-500">
                      Equivalente Bs. (tasa {Number(lastCompletedSale.exchangeRate)}):
                    </span>
                    <span className="text-sm font-mono font-black text-neutral-800">
                      {Number(lastCompletedSale.totalBs).toLocaleString('es-ES', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} Bs.
                    </span>
                  </div>
                )}
                {lastCompletedSale.settlement === 'por_cobrar' && (
                  <p className="text-[10px] font-black uppercase text-amber-600">
                    Documento pendiente por cobrar
                  </p>
                )}
                {lastCompletedSale.settlement === 'cortesia' && (
                  <p className="text-[10px] font-black uppercase text-sky-600">
                    Venta registrada como cortesía (sin cobro)
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-neutral-200">
              <button
                onClick={handlePrintReceipt}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-black transition"
              >
                <Printer className="size-4" /> Imprimir / Descargar PDF
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-6 rounded-xl border border-neutral-300 py-3 text-xs font-bold uppercase tracking-wider text-neutral-700 hover:bg-neutral-100 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
