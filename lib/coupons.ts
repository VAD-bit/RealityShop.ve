import { createClient } from './supabase/client'

const supabase = createClient()

export interface CouponRecord {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  customer_name: string | null
  note: string | null
  is_active: boolean
  max_uses: number | null
  uses: number
  created_at?: string
}

export interface CouponValidation {
  ok: boolean
  error?: string
  coupon?: CouponRecord
  discountAmount?: number
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

export function describeCoupon(c: Pick<CouponRecord, 'discount_type' | 'discount_value'>): string {
  if (c.discount_type === 'percent') return `${Number(c.discount_value)}% de descuento`
  return `$${Number(c.discount_value).toFixed(2)} de descuento`
}

export function computeCouponDiscount(
  coupon: Pick<CouponRecord, 'discount_type' | 'discount_value'>,
  baseAmount: number
): number {
  const base = Math.max(0, Number(baseAmount) || 0)
  if (coupon.discount_type === 'percent') {
    return Math.min(base, base * (Number(coupon.discount_value) / 100))
  }
  return Math.min(base, Number(coupon.discount_value) || 0)
}

export async function validateCoupon(code: string, customer?: string): Promise<CouponValidation> {
  const clean = code.trim().toUpperCase()
  if (!clean) return { ok: false, error: 'Escribe el código del cupón.' }

  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', clean)
      .single()

    if (error) {
      if (isMissingTable(error)) {
        return {
          ok: false,
          error: 'La tabla de cupones aún no existe. Ejecuta la migración en Supabase.',
        }
      }
      if (error.code === 'PGRST116') {
        return { ok: false, error: `El código "${clean}" no está autorizado.` }
      }
      throw error
    }

    const coupon = data as CouponRecord

    if (!coupon.is_active) {
      return { ok: false, error: `El cupón "${clean}" está desactivado.` }
    }
    if (coupon.max_uses != null && coupon.uses >= coupon.max_uses) {
      return { ok: false, error: `El cupón "${clean}" agotó sus usos (${coupon.uses}/${coupon.max_uses}).` }
    }
    if (
      coupon.customer_name &&
      customer &&
      coupon.customer_name.trim().toLowerCase() !== customer.trim().toLowerCase()
    ) {
      return {
        ok: false,
        error: `El cupón "${clean}" es exclusivo para ${coupon.customer_name}.`,
      }
    }

    return { ok: true, coupon }
  } catch (error: any) {
    console.error('Error validando cupón:', error)
    return { ok: false, error: 'No se pudo validar el cupón. Intenta de nuevo.' }
  }
}

export async function getCoupons(): Promise<CouponRecord[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    if (!isMissingTable(error)) throw error
    return []
  }
  return (data as CouponRecord[]) || []
}

export async function createCoupon(input: {
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  customer_name?: string
  note?: string
  max_uses?: number | null
}): Promise<CouponRecord> {
  const code = input.code.trim().toUpperCase()
  if (!code) throw new Error('El código del cupón es obligatorio.')
  if (!(input.discount_value > 0)) throw new Error('El valor del descuento debe ser mayor a 0.')
  if (input.discount_type === 'percent' && input.discount_value > 100) {
    throw new Error('El porcentaje de descuento no puede superar 100%.')
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      customer_name: input.customer_name?.trim() || null,
      note: input.note?.trim() || null,
      max_uses: input.max_uses != null && input.max_uses > 0 ? input.max_uses : null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error(`El código "${code}" ya existe.`)
    if (isMissingTable(error)) {
      throw new Error('La tabla de cupones aún no existe. Ejecuta la migración en Supabase.')
    }
    throw error
  }
  return data as CouponRecord
}

export async function setCouponActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('coupons')
    .update({ is_active: active })
    .eq('id', id)

  if (error) throw error
}

export async function deleteCoupon(id: string): Promise<void> {
  const { error } = await supabase.from('coupons').delete().eq('id', id)
  if (error) throw error
}
