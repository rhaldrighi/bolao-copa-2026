'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function verifyOTPAction(email: string, token: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'magiclink',
  })
  if (error) return { error: error.message }
  redirect('/dashboard')
}
