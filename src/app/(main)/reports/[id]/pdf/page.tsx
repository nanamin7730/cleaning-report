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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  if (!report) return <div className="text-center py-12 text-gray-400">報告書が見つかりません</div>

  return (
    <>
      {/* 印刷時のスタイル */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area {
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          body { background: white; }
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
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
      <div className="print-area bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
        {/* タイトル */}
        <h1 className="text-center text-xl font-bold text-gray-900 mb-6">
          ■ 日常清掃報告書 ■
        </h1>

        {/* ヘッダーテーブル */}
        <table className="w-full border-collapse border border-gray-700 text-sm mb-6">
          <tbody>
            <tr>
              <th className="border border-gray-700 bg-gray-100 px-3 py-2 w-24 text-left font-semibold">
                物件名
              </th>
              <td className="border border-gray-700 px-3 py-2" colSpan={3}>
                {report.properties?.name}
              </td>
            </tr>
            <tr>
              <th className="border border-gray-700 bg-gray-100 px-3 py-2 text-left font-semibold">
                所在地
              </th>
              <td className="border border-gray-700 px-3 py-2">
                {report.properties?.address}
              </td>
              <th className="border border-gray-700 bg-gray-100 px-3 py-2 w-24 text-left font-semibold">
                作業内容
              </th>
              <td className="border border-gray-700 px-3 py-2">
                {report.work_content || '掃き拭き掃除'}
              </td>
            </tr>
            <tr>
              <th className="border border-gray-700 bg-gray-100 px-3 py-2 text-left font-semibold">
                作業日時
              </th>
              <td className="border border-gray-700 px-3 py-2" colSpan={3}>
                {formatDate(report.cleaned_at)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 各項目のビフォーアフター */}
        <div className="space-y-4">
          {report.report_items.map((item) => (
            <div key={item.id} className="break-inside-avoid">
              {/* 項目名ヘッダー（薄い水色） */}
              <div
                className="border border-gray-700 px-3 py-2 font-semibold text-gray-900 text-sm"
                style={{ backgroundColor: '#D9E8F5' }}
              >
                【{item.item_name}】
              </div>

              {/* 作業前 / 作業後 ヘッダー（グレー） */}
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-gray-700 bg-gray-200 px-3 py-1.5 w-1/2 font-semibold">
                      作業前
                    </th>
                    <th className="border border-gray-700 bg-gray-200 px-3 py-1.5 w-1/2 font-semibold">
                      作業後
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-700 p-2 align-top">
                      {item.before_photo_url ? (
                        <img
                          src={item.before_photo_url}
                          alt="作業前"
                          className="w-full h-56 object-contain"
                        />
                      ) : (
                        <div className="w-full h-56 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                          写真なし
                        </div>
                      )}
                    </td>
                    <td className="border border-gray-700 p-2 align-top">
                      {item.after_photo_url ? (
                        <img
                          src={item.after_photo_url}
                          alt="作業後"
                          className="w-full h-56 object-contain"
                        />
                      ) : (
                        <div className="w-full h-56 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                          写真なし
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {item.item_notes && (
                <div className="border border-t-0 border-gray-700 px-3 py-2 text-xs text-gray-700 bg-gray-50">
                  {item.item_notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 備考 */}
        {report.notes && (
          <div className="mt-6 break-inside-avoid">
            <div
              className="border border-gray-700 px-3 py-2 font-semibold text-gray-900 text-sm"
              style={{ backgroundColor: '#D9E8F5' }}
            >
              【備考】
            </div>
            <div className="border border-t-0 border-gray-700 px-3 py-3 text-sm text-gray-800 whitespace-pre-wrap">
              {report.notes}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
