import { createClient } from './supabase/client'

const supabase = createClient()

export type SettlementType = 'pagado' | 'por_cobrar' | 'cortesia'

export interface SaleItemPayload {
  product_id: string
  inventory_id: string
  unit_price: number
  total_price: number
  quantity: number
  quantity_paid: number
  quantity_pending: number
}

export interface ProcessSalePayload {
  items: SaleItemPayload[]
  advisor: string
  customer: string
  paymentMethod: string
  paymentReference?: string
  customTotal: number | null
  tip: number
  settlement: SettlementType
  couponCode?: string
  couponDiscount?: number
}

export interface ProcessSaleResult {
  saleRef: string | null
  mode: 'rpc' | 'fallback'
}

function isMissingRpc(error: any): boolean {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes('process_sale') ||
    message.includes('could not find the function') ||
    message.includes('function public.process_sale')
  )
}

function paymentStatusFor(item: SaleItemPayload, settlement: SettlementType): string {
  if (settlement === 'cortesia') return 'cortesia'
  if (settlement === 'por_cobrar') return 'por_cobrar'
  return item.quantity_pending > 0 ? 'por_cobrar' : 'pagado'
}

async function fallbackProcess(payload: ProcessSalePayload): Promise<ProcessSaleResult> {
  const createdAt = new Date().toISOString()
  const insertedIds: string[] = []
  let couponColumnsAvailable = true

  try {
    for (const item of payload.items) {
      const baseRow: Record<string, any> = {
        product_id: item.product_id,
        inventory_id: item.inventory_id,
        advisor_name: payload.advisor || 'General',
        customer_name: payload.customer,
        unit_price: item.unit_price,
        total_price: item.total_price,
        quantity: item.quantity,
        quantity_paid: item.quantity_paid,
        quantity_pending: item.quantity_pending,
        payment_status: paymentStatusFor(item, payload.settlement),
        payment_method: payload.paymentMethod,
        payment_reference: payload.paymentReference || null,
        created_at: createdAt,
      }

      if (couponColumnsAvailable) {
        baseRow.coupon_code = payload.couponCode || null
        baseRow.coupon_discount =
          item === payload.items[payload.items.length - 1] ? payload.couponDiscount || 0 : 0
      }

      let { data, error } = await supabase.from('sales').insert(baseRow).select().single()

      if (error && couponColumnsAvailable && String(error.code) === '42703' && String(error.message).includes('coupon')) {
        couponColumnsAvailable = false
        delete baseRow.coupon_code
        delete baseRow.coupon_discount
        ;({ data, error } = await supabase.from('sales').insert(baseRow).select().single())
      }

      if (error) throw error
      if (data?.id) insertedIds.push(data.id)

      const { error: stockError } = await supabase.rpc('register_stock_entry', {
        p_inventory_id: item.inventory_id,
        p_quantity: -item.quantity,
        p_reason: 'Venta POS',
        p_advisor: payload.advisor || 'General',
      })

      if (stockError) {
        if (!isMissingRpc(stockError)) throw stockError

        const { data: row, error: selErr } = await supabase
          .from('inventory')
          .select('stock, product_id')
          .eq('id', item.inventory_id)
          .single()

        if (selErr) throw selErr

        const newStock = Math.max(0, (row?.stock || 0) - item.quantity)
        const { error: upErr } = await supabase
          .from('inventory')
          .update({ stock: newStock })
          .eq('id', item.inventory_id)

        if (upErr) throw upErr

        const { error: movErr } = await supabase.from('inventory_movements').insert({
          product_id: row?.product_id || item.product_id,
          inventory_id: item.inventory_id,
          type: 'venta',
          quantity: -item.quantity,
          reason: 'Venta POS',
          advisor_name: payload.advisor || 'General',
          created_at: createdAt,
        })

        if (movErr && !isMissingTable(movErr)) throw movErr
      }
    }

    return { saleRef: null, mode: 'fallback' }
  } catch (error) {
    if (insertedIds.length > 0) {
      await supabase.from('sales').delete().in('id', insertedIds)
    }
    throw error
  }
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

export async function processSale(payload: ProcessSalePayload): Promise<ProcessSaleResult> {
  if (payload.items.length === 0) {
    throw new Error('El carrito está vacío.')
  }

  for (const item of payload.items) {
    if (!item.inventory_id) {
      throw new Error('Una variante del carrito no tiene identificador de inventario.')
    }
  }

  const items = payload.items.map((item, index) => ({
    ...item,
    is_last: index === payload.items.length - 1,
  }))

  const { data, error } = await supabase.rpc('process_sale', {
    p_items: items,
    p_advisor: payload.advisor || 'General',
    p_customer: payload.customer,
    p_payment_method: payload.paymentMethod,
    p_payment_reference: payload.paymentReference || null,
    p_custom_total: payload.customTotal,
    p_tip: payload.tip || 0,
    p_settlement: payload.settlement,
    p_created_at: new Date().toISOString(),
    p_coupon_code: payload.couponCode || null,
    p_coupon_discount: payload.couponDiscount || 0,
  })

  if (!error) {
    const ref = (data as any)?.sale_ref || null
    return { saleRef: ref, mode: 'rpc' }
  }

  if (!isMissingRpc(error)) {
    throw error
  }

  console.warn('[processSale] RPC no disponible, usando modo respaldo sin transacción.', error.message)
  return fallbackProcess(payload)
}
