'use server'
import { createClient } from '@/lib/supabase/server'

export async function verifyOTPAction(email: string, token: string) {
  const supabase = createClient()

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) return { error: error.message }

  // Cookies de sessão gravados via cookieStore.set() — retorna sucesso para o cliente navegar
  return { success: true }
}
