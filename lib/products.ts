import { supabase } from './supabase'

export interface InventoryItem {
  id?: string
  product_id?: string
  size_or_detail: string
  stock: number
}

export interface ProductItem {
  id: string
  name: string
  category: 'zapatillas' | 'perfumes' | 'accesorios'
  subcategory: string
  price: number
  image: string
  inventory: InventoryItem[]
  created_at?: string
  sizes?: string[]
  isNew?: boolean
  gender?: 'caballeros' | 'damas' | 'niños' // Nueva propiedad añadida
}

export type Product = ProductItem

/**
 * Obtiene todos los productos con su respectivo inventario desde Supabase.
 */
export async function getProducts(): Promise<ProductItem[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, inventory(*)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching products:', error.message)
    return []
  }

  if (!data) return []

  return data.map((item) => {
    const inventoryList: InventoryItem[] = Array.isArray(item.inventory)
      ? item.inventory.map((inv: InventoryItem) => ({
          id: inv.id,
          product_id: inv.product_id,
          size_or_detail: String(inv.size_or_detail || ''),
          stock: Number(inv.stock || 0)
        }))
      : []

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory || '',
      price: Number(item.price),
      image: item.image,
      inventory: inventoryList,
      created_at: item.created_at,
      sizes: inventoryList.map((inv) => inv.size_or_detail),
      isNew: false,
      gender: item.gender // Incluido el nuevo campo
    }
  })
}

/**
 * Obtiene un producto individual por su ID con su stock asociado.
 */
export async function getProductById(id: string): Promise<ProductItem | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, inventory(*)')
    .eq('id', id)
    .single()

  if (error || !data) {
    console.error('Error fetching product by ID:', error?.message)
    return null
  }

  const inventoryList: InventoryItem[] = Array.isArray(data.inventory)
    ? data.inventory.map((inv: InventoryItem) => ({
        id: inv.id,
        product_id: inv.product_id,
        size_or_detail: String(inv.size_or_detail || ''),
        stock: Number(inv.stock || 0)
      }))
    : []

  return {
    id: data.id,
    name: data.name,
    category: data.category,
    subcategory: data.subcategory || '',
    price: Number(data.price),
    image: data.image,
    inventory: inventoryList,
    created_at: data.created_at,
    sizes: inventoryList.map((inv) => inv.size_or_detail),
    isNew: false,
    gender: data.gender // Incluido el nuevo campo
  }
}