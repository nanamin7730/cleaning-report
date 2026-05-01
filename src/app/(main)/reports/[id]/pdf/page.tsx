'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CleaningReport, Property, ReportItem } from '@/lib/types'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Printer } from 'lucide-react'

type FullReport = CleaningReport & {
  properties: Property
  report_items: ReportItem[]
}

export default function PDFPage() {
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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

  const handlePrint = () => {
    window.print()
  }

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  if (!report) return <div className="text-center py-12 text-gray-400">報告書が見つかりません</div>

  return (
    <>
      {/* 印刷時に非表示にするUI */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { margin: 0; padding: 0; }
          body { background: white; }
        }
      `}</style>

      {/* 操作ボタン（印刷時は非表示） */}
      <div className="no-print">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 text-sm"
        >
          <ChevronLeft size={18} /> 報告書へ戻る
        </button>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700">
          <p className="font-semibold mb-1">📄 PDFの保存方法</p>
          <p>下の「印刷・PDF保存」ボタンを押して、印刷ダイアログで</p>
          <p className="font-medium mt-1">「PDFに保存」または「PDF として保存」を選択してください</p>
        </div>

        <button
          onClick={handlePrint}
          className="w-full bg-blue-600 text-white rounded-xl py-4 font-semibold text-base hover:bg-blue-700 flex items-center justify-center gap-2 mb-8"
        >
          <Printer size={20} /> 印刷・PDF保存
        </button>
      </div>

      {/* 報告書本体（印刷対象） */}
      <div className="print-area bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        {/* タイトル */}
        <div className="text-center border-b-2 border-gray-200 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">清掃報告書</h1>
        </div>

        {/* 基本情報 */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-8 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex gap-2">
            <span className="text-gray-500 w-16 flex-shrink-0">物件名</span>
            <span className="font-semibold text-gray-800">{report.properties?.name}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-16 flex-shrink-0">清掃日</span>
            <span className="font-semibold text-gray-800">{formatDate(report.cleaned_at)}</span>
          </div>
          <div className="flex gap-2 col-span-2">
            <span className="text-gray-500 w-16 flex-shrink-0">住　所</span>
            <span className="font-semibold text-gray-800">{report.properties?.address}</span>
          </div>
        </div>

        {/* ビフォーアフター写真 */}
        <div className="space-y-6">
          {report.report_items.map((item, i) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-4 break-inside-avoid">
              <h3 className="font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100 text-sm">
                {i + 1}. {item.item_name}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-blue-600 mb-2">BEFORE</p>
                  {item.before_photo_url ? (
                    <img
                      src={item.before_photo_url}
                      alt="before"
                      className="w-full h-44 object-cover rounded border border-gray-200"
                    />
                  ) : (
                    <div className="w-full h-44 bg-gray-100 rounded border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                      写真なし
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-green-600 mb-2">AFTER</p>
                  {item.after_photo_url ? (
                    <img
                      src={item.after_photo_url}
                      alt="after"
                      className="w-full h-44 object-cover rounded border border-gray-200"
                    />
                  ) : (
                    <div className="w-full h-44 bg-gray-100 rounded border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                      写真なし
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

        {/* 備考 */}
        {report.notes && (
          <div className="mt-6 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-bold text-gray-500 mb-2">備考</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.notes}</p>
          </div>
        )}
      </div>
    </>
  )
}
