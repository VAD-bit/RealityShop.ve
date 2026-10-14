import { ProductItem, Advisor } from './types'

export const ADVISORS: Advisor[] = [
  { id: '1', name: 'Angel Serrano' },
  { id: '2', name: 'Jeff Carrero' },
  { id: '3', name: 'Victor Diaz' },
]

export const SUBCATEGORIES: Record<ProductItem['category'], string[]> = {
  zapatillas: ['nike', 'adidas', 'oncloud', 'jordan', 'new balance', 'puma', 'otras'],
  perfumes: ['diseñador', 'nicho', 'arabes', 'decants', 'otros'],
  accesorios: ['relojeria', 'cadenas', 'gorras', 'gafas', 'otros']
}