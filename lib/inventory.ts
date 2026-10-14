import { supabase } from './supabase'

/**
 * Obtiene el stock disponible de una talla o variante (string o número) específica para un producto.
 */
export async function getStock(productId: string, sizeOrDetail: string | number): Promise<number> {
  const formattedSize = String(sizeOrDetail).trim().toUpperCase()

  try {
    // 1. Obtener todo el inventario del producto
    const { data: inventoryList, error: invError } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', productId)

    if (!invError && inventoryList && inventoryList.length > 0) {
      // Buscar coincidencia en columnas posibles ('size_or_detail', 'size', 'detail', etc.)
      const match = inventoryList.find((item) => {
        const itemVal = String(item.size_or_detail || item.size || item.presentation || '').trim().toUpperCase()
        return itemVal === formattedSize
      })

      if (match) {
        return Number(match.stock) || 0
      }

      // Si el producto sólo tiene 1 registro en inventario (ej: perfume único, accesorio), retornar su stock
      if (inventoryList.length === 1) {
        return Number(inventoryList[0].stock) || 0
      }
    }

    // 2. Sin coincidencia en inventory: no hay stock registrado para esa variante
    return 0
  } catch (error) {
    console.error('Error fetching stock:', error)
    return 0
  }
}

/**
 * Obtiene el inventario disponible para un producto específico.
 */
export async function getInventoryByProduct(productId: string) {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('product_id', productId)

  if (error) {
    console.error('Error fetching inventory:', error.message)
    return []
  }

  return data || []
}

/**
 * Verifica si hay suficiente stock de una talla/variante en particular.
 */
export async function hasEnoughStock(productId: string, sizeOrDetail: string | number, requestedQuantity: number = 1): Promise<boolean> {
  const currentStock = await getStock(productId, sizeOrDetail)
  return currentStock >= requestedQuantity
}

/**
 * Actualiza el stock de una variante de producto tras una venta o ajuste.
 */
export async function updateStock(productId: string, sizeOrDetail: string | number, newStock: number) {
  const formattedSize = String(sizeOrDetail).trim().toUpperCase()

  // Buscar el registro para actualizarlo por 'size_or_detail'
  const { data: inventoryList } = await supabase
    .from('inventory')
    .select('id, size_or_detail')
    .eq('product_id', productId)

  let targetId: string | null = null

  if (inventoryList && inventoryList.length > 0) {
    const match = inventoryList.find((item) => {
      const itemVal = String(item.size_or_detail || item.size || '').trim().toUpperCase()
      return itemVal === formattedSize
    })
    
    if (match) {
      targetId = match.id
    } else if (inventoryList.length === 1) {
      targetId = inventoryList[0].id
    }
  }

  if (targetId) {
    const { error } = await supabase
      .from('inventory')
      .update({ stock: newStock })
      .eq('id', targetId)

    if (error) {
      console.error('Error updating stock in inventory:', error.message)
      return false
    }
    return true
  }

  // Sin registro en inventory no hay dónde aplicar el cambio
  console.error('No se encontró la variante en inventory para actualizar el stock:', productId, sizeOrDetail)
  return false
}