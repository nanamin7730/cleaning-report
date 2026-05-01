'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      // user_metadataの role が 'admin' なら管理者
      setIsAdmin(user?.user_metadata?.role === 'admin')
      setLoading(false)
    })
  }, [])

  return { isAdmin, loading }
}
