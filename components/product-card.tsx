'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, Plus } from 'lucide-react'
import { useCart } from '@/components/cart-context'
import type { ProductItem } from '@/lib/products'

export function ProductCard({ product }: { product: ProductItem }) {
  const { addItem } = useCart()
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState(false)

  // Cast flexible para capturar si stock viene en la raíz desde Supabase o desde inventory
  const p = product as any

  // 1. OBTENER STOCK TOTAL:
  // Revisa si 'stock' o 'quantity' vienen en la raíz del objeto,
  // o si viene el arreglo 'inventory'
  const rootStock = p?.stock ?? p?.quantity ?? p?.total_stock

  const inventoryStock = Array.isArray(p?.inventory)
    ? p.inventory.reduce((acc: number, item: any) => acc + (Number(item?.stock) || 0), 0)
    : null

  // Si inventory existe y tiene elementos, se toma su suma.
  // Si inventory viene vacío o null, se revisa rootStock.
  // Si nada trae stock, se asume 0 (AGOTADO).
  const finalStock = inventoryStock !== null && p?.inventory?.length > 0
    ? inventoryStock
    : (rootStock !== undefined && rootStock !== null ? Number(rootStock) : 0)

  const isOutOfStock = finalStock <= 0

  const inventoryList = p?.inventory || []

  function handleAdd() {
    if (isOutOfStock) return

    if (inventoryList.length > 0 && selectedVariant === null) {
      setError(true)
      return
    }

    const parsed = Number(parseInt(selectedVariant || '0', 10))
    const numericVariant = Number.isNaN(parsed) ? 0 : parsed

    addItem(product, numericVariant)
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  const imageSrc = product?.image
    ? product.image.startsWith('/') || product.image.startsWith('http')
      ? product.image
      : `/${product.image}`
    : '/placeholder.svg'

  return (
    <article className="group flex flex-col overflow-hidden rounded-sm border border-border bg-card transition-colors hover:border-primary/60">
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {product?.gender && (
          <span className="absolute left-3 top-3 z-10 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white border border-white/20 bg-black/50 backdrop-blur-sm">
            {product.gender}
          </span>
        )}
        <Image
          src={imageSrc}
          alt={product?.name || 'Producto'}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`object-cover transition-transform duration-500 ease-out group-hover:scale-110 ${
            isOutOfStock ? 'grayscale opacity-60' : ''
          }`}
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-heading text-lg font-bold uppercase leading-tight tracking-tight">
              {product?.name}
            </h3>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {product?.category}
            </p>
          </div>
          <p className="font-heading text-lg font-black text-primary">
            ${product?.price}
          </p>
        </div>

        <div className="mt-4">
          {/* CARTEL DE AGOTADO */}
          {isOutOfStock ? (
            <div className="my-2 rounded-sm bg-red-600/20 border border-red-600 p-2 text-center">
              <span className="font-heading text-sm font-black tracking-widest text-red-500 uppercase">
                ⚠️ AGOTADO
              </span>
            </div>
          ) : inventoryList.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {inventoryList.map((item: any) => {
                const variantString = item.size_or_detail
                const active = selectedVariant === variantString
                return (
                  <button
                    key={item.id || item.size_or_detail}
                    type="button"
                    onClick={() => {
                      setSelectedVariant(variantString)
                      setError(false)
                    }}
                    className={`h-9 min-w-9 rounded-sm border px-2 text-sm font-bold transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary text-foreground hover:border-primary'
                    }`}
                  >
                    {item.size_or_detail}
                  </button>
                )
              })}
            </div>
          ) : null}

          {error && !isOutOfStock && (
            <p className="mt-2 text-xs font-semibold text-primary">
              Por favor seleccione una opción primero.
            </p>
          )}
        </div>

        {/* BOTÓN AGOTADO / AÑADIR */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={isOutOfStock}
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-sm px-4 py-3 font-heading text-sm font-bold uppercase tracking-wide transition-colors ${
            isOutOfStock
              ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed border border-neutral-700 opacity-60'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {isOutOfStock ? (
            'AGOTADO'
          ) : added ? (
            <>
              <Check className="size-4" /> Añadido
            </>
          ) : (
            <>
              <Plus className="size-4" /> Añadir al carrito
            </>
          )}
        </button>
      </div>
    </article>
  )
}