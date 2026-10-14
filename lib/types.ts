export interface InventoryItem {
  id?: string
  size_or_detail: string
  stock: number
}

export interface InventoryVariant {
  id?: string
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
  gender?: 'caballeros' | 'damas' | 'niños'
  cost_price?: number
  profit_margin?: number
  min_stock?: number
  on_sale?: boolean
  discount_price?: number | null
  discount_percent?: number | null
  created_at?: string
}

export interface Advisor {
  id: string
  name: string
  commission_pct?: number
}
