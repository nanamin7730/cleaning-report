'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CleaningReport, Property } from '@/lib/types'
import Link from 'next/link'
import { Plus, FileText, ChevronRight, Calendar, Building2 } from 'lucide-react'

type ReportRow = CleaningReport & { properties: Property }

export default function ReportsPage() {
  const supabase = createClient()
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('cleaning_reports')
      .select('*, properties(*)')
      .order('cleaned_at', { ascending: false })
      .then(({ data }) => {
        setReports((data as ReportRow[]) ?? [])
        setLoading(false)
      })
  }, [])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FileText size={22} /> 清掃報告書
        </h1>
        <Link
          href="/reports/new"
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> 新規作成
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">報告書がまだありません</p>
          <p className="text-sm mt-1">「新規作成」から報告書を作成してください</p>
          <Link
            href="/reports/new"
            className="inline-flex items-center gap-1 mt-4 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> 最初の報告書を作成
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Link
              key={r.id}
              href={`/reports/${r.id}`}
              className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="font-semibold text-gray-800 truncate">
                      {r.properties?.name ?? '物件不明'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar size={13} />
                    <span>{formatDate(r.cleaned_at)}</span>
                  </div>
                  {r.notes && (
                    <p className="text-xs text-gray-400 mt-1.5 truncate">{r.notes}</p>
                  )}
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
