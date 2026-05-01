'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Home, FileText, Building2, LogOut } from 'lucide-react'

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/reports', label: '報告書', icon: FileText },
    { href: '/properties', label: '物件', icon: Building2 },
  ]

  return (
    <>
      {/* PC 上部ナビ */}
      <header className="hidden md:flex bg-white border-b border-gray-200 px-6 py-3 items-center justify-between">
        <Link href="/reports" className="text-lg font-bold text-gray-800">
          清掃報告書
        </Link>
        <nav className="flex items-center gap-6">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium ${
                pathname.startsWith(href) ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1"
          >
            <LogOut size={16} />
            ログアウト
          </button>
        </nav>
      </header>

      {/* スマホ 下部タブバー */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 ${
              pathname.startsWith(href) ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <Icon size={22} />
            {label}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center py-3 text-xs gap-1 text-gray-500"
        >
          <LogOut size={22} />
          ログアウト
        </button>
      </nav>
    </>
  )
}
