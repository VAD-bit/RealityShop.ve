import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Archivo, Inter } from 'next/font/google'
import { CartProvider } from '@/components/cart-context'
import { CartDrawer } from '@/components/cart-drawer'
import { CustomerProvider } from '@/lib/customer-context'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  weight: ['400', '600', '700', '800', '900'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'REALITY SHOP',
  description:
    'Step into reality. The sickest catalog of sneakers and urban footwear. Streetwear-first, drop-driven, built for the street.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/Realityshop.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      {
        url: '/Realityshop.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`dark bg-background ${archivo.variable} ${inter.variable}`}>
      <body className="font-sans antialiased overflow-x-hidden">
          <CustomerProvider>
            <CartProvider>
              {children}
              <CartDrawer />
            </CartProvider>
          </CustomerProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}