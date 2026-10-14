'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MetricsCards } from '@/components/admin/metrics-cards'
import { InventoryTable } from '@/components/admin/inventory-table'
import { ProductModal } from '@/components/admin/modals/product-modal'
import { SaleModal } from '@/components/admin/modals/sale-modal'
import { ProductItem, InventoryVariant } from '@/lib/types'
import { ADVISORS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { processSale } from '@/lib/sales'

const supabase = createClient()

export default function DashboardPage() {
  const router = useRouter()

  // 1. ESTADOS DE DATOS Y CARGA
  const [products, setProducts] = useState<ProductItem[]>([])
  const [recentProducts, setRecentProducts] = useState<ProductItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [advisors, setAdvisors] = useState<{ id: string; name: string }[]>(ADVISORS)

  // 2. ESTADOS DE MÉTRICAS (SOLO MES ACTUAL PARA RESUMEN)
  const [totalRevenue, setTotalRevenue] = useState<number>(0)
  const [potentialRevenue, setPotentialRevenue] = useState<number>(0)
  const [totalStockUnits, setTotalStockUnits] = useState<number>(0)
  const [salesCount, setSalesCount] = useState<number>(0)

  // 3. ESTADOS DE MODALES
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [isSaleModalOpen, setIsSaleModalOpen] = useState<boolean>(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [selectedProductForSale, setSelectedProductForSale] = useState<ProductItem | null>(null)
  const [selectedAdvisor, setSelectedAdvisor] = useState<string>('')
  const [saleItems, setSaleItems] = useState<Record<string, number>>({})
  const [isProcessingSale, setIsProcessingSale] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // 4. ESTADO DE FORMULARIO E IMAGEN
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'zapatillas' as ProductItem['category'],
    subcategory: '',
    price: '' as number | '',
    gender: 'caballeros' as 'caballeros' | 'damas' | 'niños',
    min_stock: 0 as number,
  })
  const [variants, setVariants] = useState<InventoryVariant[]>([
    { size_or_detail: '', stock: 0 },
  ])
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // 5. CARGA DE DATOS DE SUPABASE CON FILTRADO MENSUAL
  const fetchInventoryData = useCallback(async () => {
    setIsLoading(true)
    try {
      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      
      const thirtyDaysAgoDate = new Date()
      thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30)

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*, inventory(*)')
        .order('created_at', { ascending: false })

      if (productsError) throw productsError

      if (productsData) {
        setProducts(productsData as ProductItem[])

        let totalStock = 0
        let potentialVal = 0

        productsData.forEach((product: any) => {
          const productStock = product.inventory?.reduce(
            (sum: number, v: any) => sum + (v.stock || 0),
            0
          ) || 0
          
          totalStock += productStock
          potentialVal += (Number(product.price) || 0) * productStock
        })

        setTotalStockUnits(totalStock)
        setPotentialRevenue(potentialVal)

        const recent = (productsData as ProductItem[]).filter((product: any) => {
          const createdAt = new Date(product.created_at)
          return createdAt >= thirtyDaysAgoDate
        })
        setRecentProducts(recent)
      }

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', firstDayOfMonth)

      if (!salesError && salesData) {
        const totalUnitsSold = salesData.reduce(
          (sum: number, sale: any) => sum + (Number(sale.quantity) || 0),
          0
        )
        setSalesCount(totalUnitsSold)

        const totalRev = salesData.reduce(
          (sum: number, sale: any) => sum + (Number(sale.total_price) || 0),
          0
        )
        setTotalRevenue(totalRev)
      }

      const { data: advData, error: advError } = await supabase
        .from('advisors')
        .select('*')
        .order('name', { ascending: true })

      if (!advError && advData && advData.length > 0) {
        setAdvisors(advData)
      }
    } catch (error: any) {
      console.error('ERROR COMPLETO:', error)
      console.error('Mensaje:', error?.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventoryData()
  }, [fetchInventoryData])

  // 6. HANDLERS Y LÓGICA DE FORMULARIO
  const handleOpenEditModal = (product: ProductItem) => {
    const prod = product as ProductItem & { 
      inventory?: InventoryVariant[]; 
      image?: string; 
      image_url?: string; 
    }
    
    setEditingProductId(prod.id)
    setProductForm({
      name: prod.name,
      category: prod.category,
      subcategory: prod.subcategory || '',
      price: prod.price,
      gender: prod.gender || 'caballeros',
      min_stock: prod.min_stock ?? 0,
    })
    setVariants(prod.inventory && prod.inventory.length > 0 
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
    if (!confirm('¿Estás seguro de eliminar este producto y sus variantes?')) return

    try {
      const product = products.find((p: ProductItem) => p.id === id)

      const { error: invError } = await supabase.from('inventory').delete().eq('product_id', id)
      if (invError) throw invError

      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error

      if (product?.image && (product as any).image.includes('/products/')) {
        try {
          const path = (product as any).image.split('/products/')[1]
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

      const productPayload = {
        name: productForm.name,
        category: productForm.category,
        subcategory: productForm.subcategory,
        price: Number(productForm.price),
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
    <div className="space-y-8">
      {/* HEADER DE RESUMEN */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="ds-eyebrow">Panel de control</p>
          <h1 className="ds-text-gold mt-1 text-3xl tracking-tight">Resumen de Inventario</h1>
          <p className="mt-1 text-xs font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
            Métricas del mes actual y mercancía reciente
          </p>
        </div>
      </div>

      {/* MÉTRICAS (SOLO GANANCIAS/VENTAS DEL MES Y STOCK TOTAL) */}
      <div className="space-y-4">
        <MetricsCards
          totalRevenue={totalRevenue}
          potentialRevenue={potentialRevenue}
          totalStockUnits={totalStockUnits}
          salesCount={salesCount}
        />
      </div>

      {/* MERCANCÍA INGRESADA EN EL ÚLTIMO MES */}
      <div className="ds-card overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#1e1e22]/80 p-5">
          <div>
            <h2 className="font-heading text-sm font-black uppercase tracking-widest text-white">
              Mercancía Reciente
            </h2>
            <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
              Productos cargados en los últimos 30 días
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/inventario')}
            className="ds-btn-ghost px-4 py-2 text-xs"
          >
            Ver todo el inventario →
          </button>
        </div>

        <InventoryTable
          products={recentProducts}
          isLoading={isLoading}
          onEdit={handleOpenEditModal}
          onSale={handleOpenSaleModal}
          onDelete={handleDeleteProduct}
          showNewBadge={true}
        />
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
  )
}