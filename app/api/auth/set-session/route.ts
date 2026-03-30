import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const { access_token, refresh_token } = await request.json()

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'Tokens inválidos' }, { status: 400 })
  }

  // Cria a resposta antes para escrever os cookies nela
  const response = NextResponse.json({ success: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.setSession({ access_token, refresh_token })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return response
}
