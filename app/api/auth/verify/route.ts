import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = (formData.get('email') as string)?.trim()
  const token = (formData.get('token') as string)?.trim()

  if (!email || !token) {
    return NextResponse.redirect(new URL('/?err=Dados+inválidos', request.url))
  }

  // Resposta de sucesso: redirect para dashboard
  const successResponse = NextResponse.redirect(new URL('/dashboard', request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: object }[]) {
          // Escreve os cookies diretamente na resposta de redirect
          cookiesToSet.forEach(({ name, value, options }) => {
            successResponse.cookies.set(name, value, options as Parameters<typeof successResponse.cookies.set>[2])
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) {
    return NextResponse.redirect(
      new URL(`/?err=${encodeURIComponent(error.message)}`, request.url)
    )
  }

  // Cookies de sessão já foram escritos no successResponse via setAll
  return successResponse
}
