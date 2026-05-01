import { createClient } from '@/lib/supabase/client'
import NavBar from '@/components/NavBar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">{children}</main>
    </div>
  )
}
