'use server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function verifyOTPAction(email: string, token: string) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'magiclink',
  })

  if (error) return { error: error.message }

  // Verifica se a sessão foi estabelecida
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) return { error: 'Sessão não estabelecida após verificação' }

  return { success: true }
}
