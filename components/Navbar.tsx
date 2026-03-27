'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface NavbarProps {
  userName?: string
  isAdmin?: boolean
}

export default function Navbar({ userName, isAdmin }: NavbarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const links = [
    { href: '/dashboard',  label: '🏠 Início' },
    { href: '/palpites',   label: '⚽ Palpites' },
    { href: '/ranking',    label: '🏆 Ranking' },
    ...(isAdmin ? [{ href: '/admin', label: '⚙️ Admin' }] : []),
  ]

  return (
    <nav className="copa-header shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl">⚽</span>
            <span className="text-yellow-400 font-black text-sm tracking-wide hidden sm:block">
              BOLÃO COPA 2026
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${pathname === l.href
                    ? 'bg-white/20 text-white'
                    : 'text-green-100 hover:bg-white/10 hover:text-white'}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* User + Logout */}
          <div className="flex items-center gap-2">
            {userName && (
              <span className="text-green-200 text-xs hidden sm:block truncate max-w-[120px]">
                {userName}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-green-200 hover:text-white text-xs px-2 py-1 rounded
                         border border-green-600 hover:border-white transition-colors"
            >
              Sair
            </button>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden text-white p-1"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-3 space-y-1">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium
                  ${pathname === l.href
                    ? 'bg-white/20 text-white'
                    : 'text-green-100 hover:bg-white/10'}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
