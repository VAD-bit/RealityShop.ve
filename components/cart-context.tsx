'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Product } from '@/lib/products'
import { getStock } from '@/lib/inventory'

// 1. Aceptamos 'size' como string o number (ej. "100ML", "Unica", 42, etc.)
// y añadimos la propiedad opcional 'gender' para soportar las categorías de género.
export type CartItem = {
  id: string
  name: string
  price: number
  image: string
  size: string | number
  quantity: number
  gender?: 'Hombre' | 'Mujer' | 'Unisex' | string
  inventoryId?: string
}

type CartContextValue = {
  items: CartItem[]
  isOpen: boolean
  count: number
  total: number
  openCart: () => void
  closeCart: () => void
  addItem: (product: Product, size?: string | number, gender?: string) => Promise<void>
  removeItem: (id: string, size: string | number) => void
  updateQuantity: (id: string, size: string | number, delta: number) => Promise<void>
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

// Llave única para diferenciar el mismo producto con distintas tallas/variantes
const lineKey = (id: string, size: string | number) => `${id}-${String(size ?? 'default')}`
const STORAGE_KEY = 'reality_shop_cart_v1'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Cargar del localStorage al montar el componente
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(STORAGE_KEY)
      if (savedCart) {
        setItems(JSON.parse(savedCart))
      }
    } catch (error) {
      console.error('Error al recuperar el carrito desde localStorage:', error)
    } finally {
      setIsInitialized(true)
    }
  }, [])

  // Sincronizar en localStorage solo tras inicializar
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
  }, [items, isInitialized])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const addItem = useCallback(
    async (
      product: Product,
      size: string | number = 'Única',
      gender?: string
    ) => {
      // Intentar obtener stock. Si no existe la función para strings o falla, damos fallback a stock general
      let maxStock = 999
      try {
        if (typeof getStock === 'function') {
          const fetchedStock = await getStock(product.id, size)
          if (typeof fetchedStock === 'number') {
            maxStock = fetchedStock
          }
        }
      } catch (err) {
        console.warn('No se pudo verificar el stock específico, usando stock por defecto:', err)
      }

      if (maxStock <= 0) {
        alert('Este producto no cuenta con stock disponible actualmente.')
        return
      }

      const itemSize = size ?? 'Única'
      const itemGender = gender || product.gender || 'Unisex'

      // Localizar el inventory_id correspondiente a la talla/variante seleccionada
      const invList = Array.isArray(product.inventory) ? product.inventory : []
      const matchedInv =
        invList.find((inv) => String(inv.size_or_detail) === String(itemSize)) ||
        invList[0]
      const inventoryId = matchedInv?.id

      setItems((prev) => {
        const existing = prev.find(
          (i) => lineKey(i.id, i.size) === lineKey(product.id, itemSize)
        )

        if (existing) {
          if (existing.quantity + 1 > maxStock) {
            return prev
          }

          return prev.map((i) =>
            lineKey(i.id, i.size) === lineKey(product.id, itemSize)
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        }

        return [
          ...prev,
          {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            size: itemSize,
            gender: itemGender,
            quantity: 1,
            inventoryId,
          },
        ]
      })

      setIsOpen(true)
    },
    []
  )

  const removeItem = useCallback((id: string, size: string | number) => {
    setItems((prev) =>
      prev.filter((i) => lineKey(i.id, i.size) !== lineKey(id, size))
    )
  }, [])

  const updateQuantity = useCallback(
    async (id: string, size: string | number, delta: number) => {
      let maxStock = 999
      try {
        if (typeof getStock === 'function') {
          const fetchedStock = await getStock(id, size)
          if (typeof fetchedStock === 'number') {
            maxStock = fetchedStock
          }
        }
      } catch (err) {
        console.warn('Error al verificar stock al actualizar cantidad:', err)
      }

      setItems((prev) =>
        prev
          .map((i) => {
            if (lineKey(i.id, i.size) === lineKey(id, size)) {
              const nextQuantity = i.quantity + delta

              if (delta > 0 && nextQuantity > maxStock) {
                return i
              }

              return {
                ...i,
                quantity: Math.min(nextQuantity, maxStock),
              }
            }
            return i
          })
          .filter((i) => i.quantity > 0)
      )
    },
    []
  )

  const clear = useCallback(() => setItems([]), [])

  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  )

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * i.price, 0),
    [items]
  )

  const value = useMemo(
    () => ({
      items,
      isOpen,
      count,
      total,
      openCart,
      closeCart,
      addItem,
      removeItem,
      updateQuantity,
      clear,
    }),
    [
      items,
      isOpen,
      count,
      total,
      openCart,
      closeCart,
      addItem,
      removeItem,
      updateQuantity,
      clear,
    ]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}