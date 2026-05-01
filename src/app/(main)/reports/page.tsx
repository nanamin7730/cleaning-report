'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Property } from '@/lib/types'
import Link from 'next/link'
import { Building2, ChevronRight, FileText, Calendar } from 'lucide-react'

type PropertyWithLast = Property & {
  last_cleaned_at: string | null
  report_count: number
}

export default function ReportsPage() {
  const supabase = createClient()
  const [items, setItems] = useState<PropertyWithLast[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: props } = await supabase
        .from('properties')
        .select('*')
        .order('name')
      const { data: reports } = await supabase
        .from('cleaning_reports')
        .select('property_id, cleaned_at')
        .order('cleaned_at', { ascending: false })

      const byProp = new Map<string, { last: string | null; count: number }>()
      ;(reports ?? []).forEach((r) => {
        const cur = byProp.get(r.property_id)
        if (!cur) {
          byProp.set(r.property_id, { last: r.cleaned_at, count: 1 })
        } else {
          cur.count += 1
          if (!cur.last || r.cleaned_at > cur.last) cur.last = r.cleaned_at
        }
      })

      const merged: PropertyWithLast[] = (props ?? []).map((p) => ({
        ...p,
        last_cleaned_at: byProp.get(p.id)?.last ?? null,
        report_count: byProp.get(p.id)?.count ?? 0,
      }))
      setItems(merged)
      setLoading(false)
    }
    load()
  }, [])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <FileText size={22} /> 清掃報告書
      </h1>

      <p className="text-sm text-gray-500 mb-4">
        物件を選択して、報告書の登録・確認を行います。
      </p>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">物件が登録されていません</p>
          <p className="text-sm mt-1">管理者に物件登録を依頼してください</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/reports/property/${p.id}`}
              className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="font-semibold text-gray-800 truncate">{p.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate ml-6">{p.address}</p>
                  <div className="flex items-center gap-3 mt-2 ml-6 text-xs text-gray-500">
                    {p.last_cleaned_at ? (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        最終: {formatDate(p.last_cleaned_at)}
                      </span>
                    ) : (
                      <span className="text-gray-400">まだ報告書なし</span>
                    )}
                    {p.report_count > 0 && (
                      <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                        {p.report_count}件
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-400 ml-3 flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
