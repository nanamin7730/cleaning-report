'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FileText, Building2, LogOut, ShieldCheck } from 'lucide-react'
import { useAdmin } from '@/lib/useAdmin'

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { isAdmin } = useAdmin()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const userLinks = [
    { href: '/reports', label: '報告書', icon: FileText },
  ]

  const adminLinks = [
    { href: '/reports', label: '報告書', icon: FileText },
    { href: '/properties', label: '物件管理', icon: Building2 },
  ]

  const links = isAdmin ? adminLinks : userLinks

  return (
    <>
      {/* PC 上部ナビ */}
      <header className="hidden md:flex print:hidden bg-white border-b border-gray-200 px-6 py-3 items-center justify-between">
        <Link href="/reports" className="text-lg font-bold text-gray-800 flex items-center gap-2">
          清掃報告書
          {isAdmin && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              管理者
            </span>
          )}
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
      <nav className="md:hidden print:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
        <Link
          href="/reports"
          className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 ${
            pathname.startsWith('/reports') ? 'text-blue-600' : 'text-gray-500'
          }`}
        >
          <FileText size={22} />
          報告書
        </Link>

        {isAdmin && (
          <Link
            href="/properties"
            className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 ${
              pathname.startsWith('/properties') ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <Building2 size={22} />
            物件管理
          </Link>
        )}

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
