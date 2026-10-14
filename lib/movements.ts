import { createClient } from './supabase/client'

const supabase = createClient()

export interface MovementRecord {
  id: string
  product_id?: string
  inventory_id?: string
  type: 'entrada' | 'salida' | 'ajuste' | 'venta'
  quantity: number
  reason?: string
  advisor_name?: string
  created_at: string
  products?: { name?: string }
  inventory?: { size_or_detail?: string }
}

function isMissingTable(error: any): boolean {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  )
}

function isMissingRpc(error: any): boolean {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes('register_stock_entry') ||
    message.includes('could not find the function')
  )
}

export async function getMovements(limit = 30): Promise<MovementRecord[]> {
  try {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*, products(name), inventory(size_or_detail)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data as unknown as MovementRecord[]) || []
  } catch (error) {
    if (!isMissingTable(error)) {
      console.error('Error cargando movimientos de inventario:', error)
    }
    return []
  }
}

export interface StockEntryPayload {
  inventoryId: string
  quantity: number
  reason: string
  advisor: string
}

export async function registerStockEntry(
  payload: StockEntryPayload
): Promise<'rpc' | 'fallback'> {
  const { inventoryId, quantity, reason, advisor } = payload

  if (!inventoryId) throw new Error('Selecciona una variante de inventario.')
  if (!quantity || quantity <= 0) throw new Error('La cantidad debe ser mayor a cero.')

  const { error } = await supabase.rpc('register_stock_entry', {
    p_inventory_id: inventoryId,
    p_quantity: quantity,
    p_reason: reason || 'Entrada de mercancía',
    p_advisor: advisor || 'General',
  })

  if (!error) return 'rpc'
  if (!isMissingRpc(error)) throw error

  // Respaldo sin RPC: seleccionar stock, sumar y registrar el movimiento (con compensación).
  const { data: row, error: selErr } = await supabase
    .from('inventory')
    .select('stock, product_id')
    .eq('id', inventoryId)
    .single()

  if (selErr) throw selErr

  const currentStock = Number(row?.stock) || 0
  const { error: upErr } = await supabase
    .from('inventory')
    .update({ stock: currentStock + quantity })
    .eq('id', inventoryId)

  if (upErr) throw upErr

  const { error: movErr } = await supabase.from('inventory_movements').insert({
    product_id: row?.product_id,
    inventory_id: inventoryId,
    type: 'entrada',
    quantity,
    reason: reason || 'Entrada de mercancía',
    advisor_name: advisor || 'General',
    created_at: new Date().toISOString(),
  })

  if (movErr && !isMissingTable(movErr)) {
    await supabase.from('inventory').update({ stock: currentStock }).eq('id', inventoryId)
    throw movErr
  }

  return 'fallback'
}
