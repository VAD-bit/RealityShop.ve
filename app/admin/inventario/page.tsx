'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, Filter, Layers, PackageCheck, AlertTriangle, PackagePlus, History, TrendingDown } from 'lucide-react'
import { InventoryTable } from '@/components/admin/inventory-table'
import { ProductModal } from '@/components/admin/modals/product-modal'
import { SaleModal } from '@/components/admin/modals/sale-modal'
import { ProductItem, InventoryVariant } from '@/lib/types'
import { ADVISORS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { processSale } from '@/lib/sales'
import { getMovements, registerStockEntry, MovementRecord } from '@/lib/movements'
import { PinGate } from '@/components/admin/pin-gate'

const supabase = createClient()

export default function InventoryPage() {
  // 1. ESTADOS DE DATOS Y CARGA
  const [products, setProducts] = useState<ProductItem[]>([])
  const [movements, setMovements] = useState<MovementRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [advisors, setAdvisors] = useState<{ id: string; name: string }[]>(ADVISORS)

  // 2. FILTROS Y BÚSQUEDA
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedGender, setSelectedGender] = useState<string>('all')
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false)

  // 3. ESTADOS DE MODALES
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [isSaleModalOpen, setIsSaleModalOpen] = useState<boolean>(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [selectedProductForSale, setSelectedProductForSale] = useState<ProductItem | null>(null)
  const [selectedAdvisor, setSelectedAdvisor] = useState<string>('')
  const [saleItems, setSaleItems] = useState<Record<string, number>>({})
  const [isProcessingSale, setIsProcessingSale] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // 3b. ENTRADAS DE MERCANCÍA
  const [entryVariantId, setEntryVariantId] = useState<string>('')
  const [entryQuantity, setEntryQuantity] = useState<string>('')
  const [entryReason, setEntryReason] = useState<string>('')
  const [entryAdvisor, setEntryAdvisor] = useState<string>(ADVISORS[0]?.name || '')
  const [isSubmittingEntry, setIsSubmittingEntry] = useState<boolean>(false)

  // 4. ESTADO DE FORMULARIO E IMAGEN (Con Costo y % Ganancia)
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'zapatillas' as ProductItem['category'],
    subcategory: '',
    cost_price: '' as number | '',
    profit_margin: '' as number | '',
    price: '' as number | '',
    gender: 'caballeros' as 'caballeros' | 'damas' | 'niños',
    min_stock: 0 as number,
  })
  const [variants, setVariants] = useState<InventoryVariant[]>([
    { size_or_detail: '', stock: 0 },
  ])
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // 5. CARGAR INVENTARIO COMPLETO
  const fetchInventoryData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, inventory(*)')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setProducts(data as ProductItem[])

      const { data: advData, error: advError } = await supabase
        .from('advisors')
        .select('*')
        .order('name', { ascending: true })

      if (!advError && advData && advData.length > 0) {
        setAdvisors(advData)
      }

      setMovements(await getMovements(25))
    } catch (error) {
      console.error('Error cargando inventario:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventoryData()
  }, [fetchInventoryData])

  // 6. FILTRADO DINÁMICO DE PRODUCTOS
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.subcategory && product.subcategory.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesCategory =
        selectedCategory === 'all' || product.category === selectedCategory

      const matchesGender =
        selectedGender === 'all' || product.gender === selectedGender

      if (lowStockOnly) {
        const prodStock = product.inventory?.reduce((acc, item) => acc + (item.stock || 0), 0) || 0
        const minStock = Number(product.min_stock) || 0
        if (!(prodStock <= minStock)) return false
      }

      return matchesSearch && matchesCategory && matchesGender
    })
  }, [products, searchTerm, selectedCategory, selectedGender, lowStockOnly])

  // METRICAS RÁPIDAS DEL CATÁLOGO
  const catalogMetrics = useMemo(() => {
    let totalStock = 0
    let outOfStockCount = 0
    let lowStockCount = 0
    let totalValue = 0
    let totalCostValue = 0

    products.forEach((prod) => {
      const prodStock = prod.inventory?.reduce((acc, item) => acc + (item.stock || 0), 0) || 0
      const minStock = Number(prod.min_stock) || 0
      const cost = Number(prod.cost_price) || 0

      totalStock += prodStock
      totalValue += prodStock * (Number(prod.price) || 0)
      totalCostValue += prodStock * cost
      if (prodStock === 0) outOfStockCount++
      if (minStock > 0 && prodStock <= minStock) lowStockCount++
    })

    return {
      totalProducts: products.length,
      totalStock,
      outOfStockCount,
      lowStockCount,
      totalValue,
      totalCostValue,
    }
  }, [products])

  // LISTADO PLANO DE VARIANTES PARA EL FORMULARIO DE ENTRADAS
  const allVariants = useMemo(() => {
    const list: { key: string; label: string; productId: string; variantId: string }[] = []
    products.forEach((prod) => {
      (prod.inventory || []).forEach((inv) => {
        if (!inv.id) return
        list.push({
          key: inv.id,
          label: `${prod.name} — ${inv.size_or_detail} (stock: ${inv.stock})`,
          productId: prod.id,
          variantId: inv.id,
        })
      })
    })
    return list.sort((a, b) => a.label.localeCompare(b.label))
  }, [products])

  // 7. HANDLERS DE FORMULARIO Y EDICIÓN
  const handleOpenCreateModal = () => {
    setEditingProductId(null)
    setProductForm({
      name: '',
      category: 'zapatillas',
      subcategory: '',
      cost_price: '',
      profit_margin: '',
      price: '',
      gender: 'caballeros',
      min_stock: 0,
    })
    setVariants([{ size_or_detail: '', stock: 0 }])
    setImagePreview(null)
    setSelectedFile(null)
    setIsAddModalOpen(true)
  }

  const handleOpenEditModal = (product: ProductItem) => {
    const prod = product as ProductItem & {
      inventory?: InventoryVariant[]
      image?: string
      image_url?: string
      cost_price?: number
      profit_margin?: number
    }

    setEditingProductId(prod.id)
    setProductForm({
      name: prod.name,
      category: prod.category,
      subcategory: prod.subcategory || '',
      cost_price: prod.cost_price ?? '',
      profit_margin: prod.profit_margin ?? '',
      price: prod.price,
      gender: prod.gender || 'caballeros',
      min_stock: prod.min_stock ?? 0,
    })
    setVariants(
      prod.inventory && prod.inventory.length > 0
        ? prod.inventory
        : [{ size_or_detail: '', stock: 0 }]
    )

    setImagePreview(prod.image || prod.image_url || null)
    setSelectedFile(null)
    setIsAddModalOpen(true)
  }

  const handleOpenSaleModal = (product: ProductItem) => {
    setSelectedProductForSale(product)
    setSaleItems({})
    setSelectedAdvisor('')
    setIsSaleModalOpen(true)
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto y sus variantes del inventario?')) return

    try {
      const product = products.find((p) => p.id === id)

      const { error: invError } = await supabase.from('inventory').delete().eq('product_id', id)
      if (invError) throw invError

      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error

      if (product?.image && product.image.includes('/products/')) {
        try {
          const path = product.image.split('/products/')[1]
          if (path) {
            await supabase.storage.from('products').remove([decodeURIComponent(path)])
          }
        } catch (imgError) {
          console.warn('No se pudo borrar la imagen del bucket:', imgError)
        }
      }

      await fetchInventoryData()
    } catch (error) {
      alert('Error al eliminar producto')
      console.error(error)
    }
  }

  const handleRegisterEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = Number(entryQuantity)
    if (!entryVariantId || !qty || qty <= 0) {
      alert('Selecciona una variante y una cantidad mayor a cero.')
      return
    }

    setIsSubmittingEntry(true)
    try {
      await registerStockEntry({
        inventoryId: entryVariantId,
        quantity: qty,
        reason: entryReason.trim() || 'Entrada de mercancía',
        advisor: entryAdvisor || 'General',
      })

      setEntryQuantity('')
      setEntryReason('')
      await fetchInventoryData()
    } catch (error: any) {
      console.error('Error registrando entrada:', error)
      alert(`No se pudo registrar la entrada.${error?.message ? `\n${error.message}` : ''}`)
    } finally {
      setIsSubmittingEntry(false)
    }
  }

  const handleCategoryChange = (cat: ProductItem['category']) => {
    setProductForm((prev) => ({ ...prev, category: cat }))
  }

  const handleVariantChange = (
    index: number,
    field: keyof InventoryVariant,
    value: string
  ) => {
    const updated = [...variants]
    if (field === 'stock') {
      updated[index][field] = Math.max(0, Number(value) || 0)
    } else {
      updated[index][field] = value
    }
    setVariants(updated)
  }

  const handleAddVariant = () => {
    setVariants((prev) => [...prev, { size_or_detail: '', stock: 0 }])
  }

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSaleQuantityChange = (key: string, qty: number, maxStock: number) => {
    setSaleItems((prev) => ({
      ...prev,
      [key]: Math.min(Math.max(0, qty), maxStock),
    }))
  }

  const handleConfirmSale = async () => {
    if (!selectedProductForSale) return
    setIsProcessingSale(true)

    try {
      const unitPrice = Number(selectedProductForSale.price) || 0
      const productWithInventory = selectedProductForSale as ProductItem & { inventory?: InventoryVariant[] }

      const items = Object.entries(saleItems)
        .filter(([, qty]) => qty > 0)
        .map(([variantId, qty]) => {
          const variant = productWithInventory.inventory?.find((v: InventoryVariant) => v.id === variantId)
          if (!variant) return null

          return {
            product_id: selectedProductForSale.id,
            inventory_id: variantId,
            unit_price: unitPrice,
            total_price: unitPrice * qty,
            quantity: qty,
            quantity_paid: qty,
            quantity_pending: 0,
          }
        })
        .filter(Boolean) as {
        product_id: string
        inventory_id: string
        unit_price: number
        total_price: number
        quantity: number
        quantity_paid: number
        quantity_pending: number
      }[]

      if (items.length === 0) {
        alert('Selecciona al menos una variante con cantidad mayor a cero.')
        return
      }

      await processSale({
        items,
        advisor: selectedAdvisor || 'General',
        customer: 'Cliente General',
        paymentMethod: 'Efectivo',
        customTotal: null,
        tip: 0,
        settlement: 'pagado',
      })

      await fetchInventoryData()
      setIsSaleModalOpen(false)
    } catch (error: any) {
      console.error('Error procesando la venta:', error)
      alert(`Ocurrió un error al procesar la venta.${error?.message ? `\n${error.message}` : ''}`)
    } finally {
      setIsProcessingSale(false)
    }
  }

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      let imageUrl = imagePreview

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, selectedFile, { upsert: true })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('products')
          .getPublicUrl(filePath)

        imageUrl = publicUrlData.publicUrl
      }

      let productId = editingProductId

      // CÁLCULO DEL PRECIO FINAL
      const cost = Number(productForm.cost_price) || 0
      const margin = Number(productForm.profit_margin) || 0
      const calculatedPrice = cost > 0 ? Math.round((cost + (cost * margin / 100)) * 100) / 100 : Number(productForm.price) || 0

      const productPayload = {
        name: productForm.name,
        category: productForm.category,
        subcategory: productForm.subcategory,
        cost_price: cost,
        profit_margin: margin,
        price: calculatedPrice,
        gender: productForm.gender,
        min_stock: Math.max(0, Number(productForm.min_stock) || 0),
        image: imageUrl,
      }

      if (editingProductId) {
        const { error } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', editingProductId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert(productPayload)
          .select()
          .single()

        if (error) throw error
        productId = data.id
      }

      if (productId) {
        for (const variant of variants) {
          if (variant.size_or_detail) {
            if (variant.id) {
              const { error } = await supabase
                .from('inventory')
                .update({ size_or_detail: variant.size_or_detail, stock: variant.stock })
                .eq('id', variant.id)

              if (error) throw error
            } else {
              const { error } = await supabase
                .from('inventory')
                .insert({
                  product_id: productId,
                  size_or_detail: variant.size_or_detail,
                  stock: variant.stock,
                })

              if (error) throw error
            }
          }
        }
      }

      await fetchInventoryData()
      setIsAddModalOpen(false)
    } catch (error) {
      console.error('Error al guardar el producto:', error)
      alert('Error al guardar el producto')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PinGate sectionName="Inventario">
    <div className="space-y-8">
      {/* CABECERA */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="ds-eyebrow">Gestión de stock</p>
          <h1 className="ds-text-gold mt-1 text-3xl tracking-tight">Inventario y Catálogo</h1>
          <p className="mt-1 text-xs font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
            Control de mercancía, existencias y variantes registradas
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="ds-btn-gold px-6 py-3 text-xs uppercase tracking-widest"
        >
          <Plus className="size-4" />
          Agregar Nuevo Producto
        </button>
      </div>

      {/* TARJETAS RÁPIDAS DE ESTADO DEL CATÁLOGO */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="ds-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Modelos</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-[#ef4444]/20 bg-[#242428]">
              <Layers className="size-4 text-[#ef4444]" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-white">{catalogMetrics.totalProducts}</p>
        </div>

        <div className="ds-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Unidades en Stock</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-[#ef4444]/20 bg-[#242428]">
              <PackageCheck className="size-4 text-[#ef4444]" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-white">{catalogMetrics.totalStock}</p>
        </div>

        <div className="ds-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Agotados</span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <AlertTriangle className="size-4 text-amber-400" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-amber-400">{catalogMetrics.outOfStockCount}</p>
        </div>

        <div
          onClick={() => setLowStockOnly((prev) => !prev)}
          className={`ds-card cursor-pointer rounded-xl p-5 transition ${
            lowStockOnly ? 'border-orange-500/60 bg-orange-950/30' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow" style={{ color: lowStockOnly ? '#fb923c' : undefined }}>
              Stock Bajo
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
              <TrendingDown className="size-4 text-orange-400" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-orange-400">{catalogMetrics.lowStockCount}</p>
          <span className="mt-1 block text-[9px] font-bold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
            {lowStockOnly ? 'Filtro activo — clic para quitar' : 'Clic para filtrar'}
          </span>
        </div>

        <div className="ds-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="ds-eyebrow">Valor del Catálogo</span>
            <span className="font-mono text-xs font-black" style={{ color: 'var(--ds-txt-3)' }}>USD</span>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-white">
            ${catalogMetrics.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-[9px] font-bold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
            Al costo: ${catalogMetrics.totalCostValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="ds-card flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2" style={{ color: 'var(--ds-txt-3)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre o marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ds-input ds-input-icon"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-neutral-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-bold uppercase text-neutral-300 outline-none focus:border-red-600 transition"
            >
              <option value="all">Todas las Categorías</option>
              <option value="zapatillas">Zapatillas</option>
              <option value="perfumes">Perfumes</option>
              <option value="accesorios">Accesorios</option>
            </select>
          </div>

          <select
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
            className="ds-input"
          >
            <option value="all">Todos los Géneros</option>
            <option value="caballeros">Caballeros</option>
            <option value="damas">Damas</option>
            <option value="niños">Niños</option>
          </select>
        </div>
      </div>

      {/* TABLA DEL INVENTARIO */}
      <div className="ds-card overflow-hidden rounded-2xl">
        <InventoryTable
          products={filteredProducts}
          isLoading={isLoading}
          onEdit={handleOpenEditModal}
          onSale={handleOpenSaleModal}
          onDelete={handleDeleteProduct}
          showNewBadge={true}
        />
      </div>

      {/* ENTRADAS DE MERCANCÍA + MOVIMIENTOS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="ds-card rounded-2xl p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-white/[0.06] pb-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-[#ef4444]/20 bg-[#242428]">
              <PackagePlus className="size-4 text-[#ef4444]" />
            </div>
            <h2 className="font-heading text-sm font-black uppercase tracking-widest text-white">
              Registrar Entrada de Mercancía
            </h2>
          </div>

          <form onSubmit={handleRegisterEntry} className="space-y-4">
            <div>
              <label className="ds-eyebrow mb-1.5 block">Producto y Variante</label>
              <select
                required
                value={entryVariantId}
                onChange={(e) => setEntryVariantId(e.target.value)}
                className="ds-input"
              >
                <option value="">Selecciona una variante...</option>
                {allVariants.map((v) => (
                  <option key={v.key} value={v.variantId}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ds-eyebrow mb-1.5 block">Cantidad a Ingresar</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="0"
                  value={entryQuantity}
                  onChange={(e) => setEntryQuantity(e.target.value)}
                  className="ds-input font-mono text-sm font-bold text-white"
                />
              </div>
              <div>
                <label className="ds-eyebrow mb-1.5 block">Responsable</label>
                <select
                  value={entryAdvisor}
                  onChange={(e) => setEntryAdvisor(e.target.value)}
                  className="ds-input"
                >
                  {advisors.map((adv) => (
                    <option key={adv.id || adv.name} value={adv.name}>
                      {adv.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="ds-eyebrow mb-1.5 block">Motivo (opcional)</label>
              <input
                type="text"
                placeholder="Ej: Reposición proveedor, compra local, ajuste..."
                value={entryReason}
                onChange={(e) => setEntryReason(e.target.value)}
                className="ds-input"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingEntry}
              className="ds-btn-gold w-full py-3 text-xs uppercase tracking-widest"
            >
              {isSubmittingEntry ? 'Registrando...' : 'Sumar al Stock'}
            </button>
          </form>
        </div>

        <div className="ds-card overflow-hidden rounded-2xl">
          <div className="flex items-center gap-2 border-b border-white/[0.06] p-4">
            <div className="flex size-8 items-center justify-center rounded-lg border border-[#ef4444]/20 bg-[#242428]">
              <History className="size-4 text-[#ef4444]" />
            </div>
            <h2 className="font-heading text-sm font-black uppercase tracking-widest text-white">
              Últimos Movimientos
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs font-bold uppercase text-neutral-500">
              Cargando movimientos...
            </div>
          ) : movements.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold uppercase text-neutral-500">
              Sin movimientos registrados todavía.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-neutral-800 bg-neutral-950/90 text-[10px] uppercase tracking-widest text-neutral-400">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3 text-right">Cant.</th>
                    <th className="p-3">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-neutral-800/20">
                      <td className="p-3 font-mono text-[10px] text-neutral-400">
                        {new Date(mov.created_at).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="p-3 font-semibold text-white">
                        {mov.products?.name || '—'}
                        <span className="block text-[10px] text-neutral-500">
                          {mov.inventory?.size_or_detail || ''}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                            mov.type === 'entrada'
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                              : mov.type === 'venta'
                                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                                : 'bg-sky-500/10 border border-sky-500/30 text-sky-400'
                          }`}
                        >
                          {mov.type}
                        </span>
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-black ${
                          Number(mov.quantity) >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {Number(mov.quantity) >= 0 ? '+' : ''}
                        {Number(mov.quantity)}
                      </td>
                      <td className="p-3 text-[10px] text-neutral-400">
                        {mov.reason || '—'}
                        {mov.advisor_name ? (
                          <span className="block text-neutral-500">{mov.advisor_name}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODALES */}
      <SaleModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        product={selectedProductForSale}
        selectedAdvisor={selectedAdvisor}
        setSelectedAdvisor={setSelectedAdvisor}
        saleItems={saleItems}
        onQuantityChange={handleSaleQuantityChange}
        onConfirmSale={handleConfirmSale}
        isProcessing={isProcessingSale}
        advisors={advisors}
      />

      <ProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        editingProductId={editingProductId}
        productForm={productForm}
        setProductForm={setProductForm}
        variants={variants}
        handleCategoryChange={handleCategoryChange}
        handleVariantChange={handleVariantChange}
        handleAddVariant={handleAddVariant}
        handleRemoveVariant={handleRemoveVariant}
        imagePreview={imagePreview}
        handleImageChange={handleImageChange}
        handleSubmit={handleProductSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
    </PinGate>
  )
}