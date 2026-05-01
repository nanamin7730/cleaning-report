'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CleaningReport, Property, ReportItem } from '@/lib/types'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, FileDown, Trash2, Calendar, Building2, MapPin } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

type FullReport = CleaningReport & {
  properties: Property
  report_items: ReportItem[]
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [report, setReport] = useState<FullReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('cleaning_reports')
      .select('*, properties(*), report_items(*)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as FullReport
          d.report_items = d.report_items.sort((a, b) => a.sort_order - b.sort_order)
          setReport(d)
        }
        setLoading(false)
      })
  }, [id])

  const handleDelete = async () => {
    if (!confirm('この報告書を削除しますか？（写真も含めて完全に削除されます）')) return
    await supabase.from('cleaning_reports').delete().eq('id', id)
    router.push('/reports')
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  if (!report) return <div className="text-center py-12 text-gray-400">報告書が見つかりません</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
          <ChevronLeft size={18} /> 一覧へ戻る
        </button>
        <div className="flex items-center gap-2">
          <Link
            href={`/reports/${id}/pdf`}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <FileDown size={16} /> PDF出力
          </Link>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 text-red-400 hover:text-red-600 px-3 py-2 rounded-lg border border-red-200 text-sm"
          >
            <Trash2 size={15} /> 削除
          </button>
        </div>
      </div>

      {/* ヘッダー情報 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
        <h1 className="text-xl font-bold text-gray-800 mb-3">清掃報告書</h1>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-gray-700">
            <Building2 size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
            <div>
              <p className="font-semibold">{report.properties?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin size={16} className="flex-shrink-0 text-gray-400" />
            <p className="text-sm">{report.properties?.address}</p>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar size={16} className="flex-shrink-0 text-gray-400" />
            <p className="text-sm">{formatDate(report.cleaned_at)}</p>
          </div>
          {report.notes && (
            <div className="mt-3 bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">備考</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* ビフォーアフター写真 */}
      <div className="space-y-5">
        {report.report_items.map((item, i) => (
          <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">
              {i + 1}. {item.item_name}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold text-blue-600 mb-1.5">BEFORE</p>
                {item.before_photo_url ? (
                  <Image
                    src={item.before_photo_url}
                    alt={`${item.item_name} ビフォー`}
                    width={400}
                    height={300}
                    className="w-full h-40 object-cover rounded-lg border border-gray-100"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-50 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-400">写真なし</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-green-600 mb-1.5">AFTER</p>
                {item.after_photo_url ? (
                  <Image
                    src={item.after_photo_url}
                    alt={`${item.item_name} アフター`}
                    width={400}
                    height={300}
                    className="w-full h-40 object-cover rounded-lg border border-gray-100"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-50 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-400">写真なし</span>
                  </div>
                )}
              </div>
            </div>
            {item.item_notes && (
              <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded p-2">
                {item.item_notes}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link
          href={`/reports/${id}/pdf`}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-4 font-semibold text-base hover:bg-blue-700"
        >
          <FileDown size={20} /> PDFで書き出す
        </Link>
      </div>
    </div>
  )
}
