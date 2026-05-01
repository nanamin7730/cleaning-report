'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CleaningReport, Property, ReportItem } from '@/lib/types'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, FileDown, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((m) => m.PDFDownloadLink),
  { ssr: false }
)

import CleaningReportPDF from '@/components/CleaningReportPDF'

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
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
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

  const fileName = report
    ? `清掃報告書_${report.properties?.name}_${report.cleaned_at}.pdf`
    : '清掃報告書.pdf'

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  if (!report) return <div className="text-center py-12 text-gray-400">報告書が見つかりません</div>

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6 text-sm">
        <ChevronLeft size={18} /> 報告書へ戻る
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm text-center">
        <FileDown size={48} className="mx-auto mb-4 text-blue-500" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">PDF書き出し</h1>
        <p className="text-gray-500 text-sm mb-1">{report.properties?.name}</p>
        <p className="text-gray-500 text-sm mb-6">{formatDate(report.cleaned_at)}</p>

        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left text-sm text-gray-600 space-y-1">
          <p>・物件名・住所・清掃日</p>
          <p>・各撮影項目のビフォーアフター写真（横並び）</p>
          <p>・備考欄</p>
          <p className="text-xs text-gray-400 mt-2">
            ※ 写真は外部URLから読み込むため、生成に少し時間がかかる場合があります
          </p>
        </div>

        {isClient && (
          <PDFDownloadLink
            document={<CleaningReportPDF report={report} />}
            fileName={fileName}
          >
            {({ loading: pdfLoading }) => (
              <button
                disabled={pdfLoading}
                className="w-full bg-blue-600 text-white rounded-xl py-4 font-semibold text-base hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {pdfLoading ? (
                  <><Loader2 size={20} className="animate-spin" /> PDF生成中...</>
                ) : (
                  <><FileDown size={20} /> PDFをダウンロード</>
                )}
              </button>
            )}
          </PDFDownloadLink>
        )}
      </div>

      {/* プレビュー（Web表示） */}
      <div className="mt-8">
        <h2 className="font-semibold text-gray-700 mb-4">プレビュー</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="text-center border-b border-gray-200 pb-4 mb-6">
            <h2 className="text-2xl font-bold text-gray-800">清掃報告書</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-6">
            <div>
              <span className="text-gray-500">物件名：</span>
              <span className="font-medium">{report.properties?.name}</span>
            </div>
            <div>
              <span className="text-gray-500">清掃日：</span>
              <span className="font-medium">{formatDate(report.cleaned_at)}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">住　所：</span>
              <span className="font-medium">{report.properties?.address}</span>
            </div>
          </div>

          {report.report_items.map((item, i) => (
            <div key={item.id} className="mb-6 border border-gray-100 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-3 text-sm">
                {i + 1}. {item.item_name}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-blue-600 mb-1">BEFORE</p>
                  {item.before_photo_url ? (
                    <img src={item.before_photo_url} alt="before" className="w-full h-36 object-cover rounded border" />
                  ) : (
                    <div className="w-full h-36 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">写真なし</div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-green-600 mb-1">AFTER</p>
                  {item.after_photo_url ? (
                    <img src={item.after_photo_url} alt="after" className="w-full h-36 object-cover rounded border" />
                  ) : (
                    <div className="w-full h-36 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">写真なし</div>
                  )}
                </div>
              </div>
              {item.item_notes && (
                <p className="text-xs text-gray-500 mt-2">{item.item_notes}</p>
              )}
            </div>
          ))}

          {report.notes && (
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 mb-1">備考</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
