import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/admin/login']

const FALLBACK_ADMINS = ['administrador@reality.com']
const FALLBACK_ADVISORS = ['victor@reality.com', 'jeff@reality.com', 'angel@reality.com']

type Role = 'admin' | 'advisor'

async function resolveRole(
  supabase: ReturnType<typeof createServerClient>,
  email: string | undefined
): Promise<Role> {
  if (!email) return 'advisor'
  const key = email.toLowerCase()

  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('email', key)
      .single()
    if (data?.role === 'admin' || data?.role === 'advisor') return data.role
  } catch {
    /* tabla no existe aún → fallback */
  }

  if (FALLBACK_ADMINS.includes(key)) return 'admin'
  if (FALLBACK_ADVISORS.includes(key)) return 'advisor'
  // Sin perfil conocido → rol restringido (sin acceso al panel admin)
  return 'advisor'
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p)

  // Sin sesión → login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const role = await resolveRole(supabase, user?.email)
  const home = role === 'advisor' ? '/advisor' : '/admin'

  // Con sesión en el login → al home de su rol
  if (user && isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = home
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Separación de roles (solo con sesión, en rutas protegidas)
  if (user && !isPublic) {
    if (role === 'advisor' && pathname.startsWith('/admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/advisor'
      url.search = ''
      return NextResponse.redirect(url)
    }

    if (role === 'admin' && pathname.startsWith('/advisor')) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/advisor/:path*'],
}
