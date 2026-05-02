'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Property, CleaningReport } from '@/lib/types'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Calendar, ChevronRight, Building2, MapPin } from 'lucide-react'

export default function PropertyReportsPage() {
  const { propertyId } = useParams<{ propertyId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [property, setProperty] = useState<Property | null>(null)
  const [reports, setReports] = useState<CleaningReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: prop }, { data: reps }] = await Promise.all([
        supabase.from('properties').select('*').eq('id', propertyId).single(),
        supabase
          .from('cleaning_reports')
          .select('*')
          .eq('property_id', propertyId)
          .order('cleaned_at', { ascending: false }),
      ])
      setProperty(prop)
      setReports(reps ?? [])
      setLoading(false)
    }
    load()
  }, [propertyId])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    })

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  if (!property) return <div className="text-center py-12 text-gray-400">物件が見つかりません</div>

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 text-sm">
        <ChevronLeft size={18} /> 物件一覧へ戻る
      </button>

      {/* 物件情報 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
        <div className="flex items-start gap-2 mb-2">
          <Building2 size={18} className="text-gray-400 mt-1 flex-shrink-0" />
          <h1 className="text-lg font-bold text-gray-800">{property.name}</h1>
        </div>
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <p>{property.address}</p>
        </div>
      </div>

      {/* 新規登録ボタン */}
      <Link
        href={`/reports/new?propertyId=${propertyId}`}
        className="w-full bg-blue-600 text-white rounded-xl py-4 font-semibold text-base hover:bg-blue-700 flex items-center justify-center gap-2 mb-6"
      >
        <Plus size={20} /> 新しい報告書を作成
      </Link>

      {/* 過去の報告書一覧 */}
      <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Calendar size={18} /> 過去の報告書
      </h2>

      {reports.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-xl text-gray-400 text-sm">
          まだ報告書がありません。
          <br />
          上のボタンから最初の報告書を作成してください。
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Link
              key={r.id}
              href={`/reports/${r.id}`}
              className="flex items-center bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4"
            >
              <Calendar size={16} className="text-gray-400 mr-3 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-800">{formatDate(r.cleaned_at)}</p>
                {r.work_content && (
                  <p className="text-xs text-gray-500 mt-0.5">{r.work_content}</p>
                )}
                {r.notes && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{r.notes}</p>
                )}
              </div>
              <ChevronRight size={18} className="text-gray-400 ml-2 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
