'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CleaningReport, Property, ReportItem } from '@/lib/types'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Camera, Image as ImageIcon, X, CheckCircle } from 'lucide-react'
import Image from 'next/image'
import { compressImage } from '@/lib/compressImage'

type FullReport = CleaningReport & {
  properties: Property
  report_items: ReportItem[]
}

type EditDraft = {
  id: string
  item_name: string
  before_url: string | null
  after_url: string | null
  before_file: File | null
  after_file: File | null
  before_preview: string | null
  after_preview: string | null
  item_notes: string
}

export default function EditReportPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [report, setReport] = useState<FullReport | null>(null)
  const [cleanedAt, setCleanedAt] = useState('')
  const [workContent, setWorkContent] = useState('')
  const [notes, setNotes] = useState('')
  const [drafts, setDrafts] = useState<EditDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
          setCleanedAt(d.cleaned_at)
          setWorkContent(d.work_content ?? '')
          setNotes(d.notes ?? '')
          setDrafts(d.report_items.map((it) => ({
            id: it.id,
            item_name: it.item_name,
            before_url: it.before_photo_url,
            after_url: it.after_photo_url,
            before_file: null,
            after_file: null,
            before_preview: null,
            after_preview: null,
            item_notes: it.item_notes ?? '',
          })))
        }
        setLoading(false)
      })
  }, [id])

  const handleFileChange = async (
    index: number,
    type: 'before' | 'after',
    file: File | null
  ) => {
    if (!file) return
    const compressed = await compressImage(file, { maxWidth: 1600, quality: 0.8 })
    const preview = URL.createObjectURL(compressed)
    setDrafts((prev) => prev.map((d, i) =>
      i === index
        ? { ...d, [`${type}_file`]: compressed, [`${type}_preview`]: preview }
        : d
    ))
  }

  const removeExistingPhoto = (index: number, type: 'before' | 'after') => {
    setDrafts((prev) => prev.map((d, i) =>
      i === index
        ? { ...d, [`${type}_url`]: null, [`${type}_file`]: null, [`${type}_preview`]: null }
        : d
    ))
  }

  const uploadPhoto = async (file: File, path: string) => {
    const { error } = await supabase.storage
      .from('report-photos')
      .upload(path, file, { upsert: true })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('report-photos').getPublicUrl(path)
    return publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      // 報告書本体の更新
      await supabase.from('cleaning_reports').update({
        cleaned_at: cleanedAt,
        work_content: workContent || null,
        notes: notes || null,
      }).eq('id', id)

      const timestamp = Date.now()

      // 各項目を更新
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i]
        let beforeUrl = d.before_url
        let afterUrl = d.after_url

        if (d.before_file) {
          beforeUrl = await uploadPhoto(d.before_file, `${id}/${timestamp}_${i}_before.jpg`)
        }
        if (d.after_file) {
          afterUrl = await uploadPhoto(d.after_file, `${id}/${timestamp}_${i}_after.jpg`)
        }

        await supabase.from('report_items').update({
          before_photo_url: beforeUrl,
          after_photo_url: afterUrl,
          item_notes: d.item_notes || null,
        }).eq('id', d.id)
      }

      // 更新後の内容で Google Drive の PDF を再アップロード（バックグラウンド）
      fetch('/api/save-pdf-to-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id }),
      }).catch((e) => console.error('Drive upload failed:', e))

      router.push(`/reports/${id}`)
    } catch (err) {
      alert('保存中にエラーが発生しました。')
      console.error(err)
    }
    setSaving(false)
  }

  const PhotoEditor = ({
    existingUrl,
    preview,
    onChange,
    onRemove,
    label,
    color,
  }: {
    existingUrl: string | null
    preview: string | null
    onChange: (f: File) => void
    onRemove: () => void
    label: string
    color: 'blue' | 'green'
  }) => {
    const cameraRef = useRef<HTMLInputElement>(null)
    const albumRef = useRef<HTMLInputElement>(null)
    const showImg = preview || existingUrl
    const colorClass = color === 'blue' ? 'border-blue-200 text-blue-600' : 'border-green-200 text-green-600'

    return (
      <div className="flex-1">
        <p className={`text-xs font-bold mb-1 ${color === 'blue' ? 'text-blue-600' : 'text-green-600'}`}>
          {label}
        </p>
        {showImg ? (
          <div className="relative">
            <Image
              src={showImg}
              alt={label}
              width={300}
              height={200}
              className="w-full h-32 object-cover rounded-lg border"
            />
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow"
            >
              <X size={14} className="text-gray-600" />
            </button>
            <div className="flex gap-1 mt-1">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex-1 text-xs py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1"
              >
                <Camera size={12} /> 撮り直し
              </button>
              <button
                type="button"
                onClick={() => albumRef.current?.click()}
                className="flex-1 text-xs py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1"
              >
                <ImageIcon size={12} /> 選び直し
              </button>
            </div>
          </div>
        ) : (
          <div className={`w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-stretch p-2 gap-1 ${colorClass}`}>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1 text-xs bg-white rounded hover:bg-gray-50"
            >
              <Camera size={16} /> カメラで撮影
            </button>
            <button
              type="button"
              onClick={() => albumRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1 text-xs bg-white rounded hover:bg-gray-50"
            >
              <ImageIcon size={16} /> アルバムから選択
            </button>
          </div>
        )}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onChange(f)
            e.target.value = ''
          }}
        />
        <input
          ref={albumRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onChange(f)
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  if (!report) return <div className="text-center py-12 text-gray-400">報告書が見つかりません</div>

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 text-sm">
        <ChevronLeft size={18} /> 戻る
      </button>
      <h1 className="text-xl font-bold text-gray-800 mb-6">報告書を編集</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-700">基本情報</h2>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">物件</label>
            <p className="text-base text-gray-800">{report.properties?.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">清掃日 *</label>
            <input
              type="date"
              value={cleanedAt}
              onChange={(e) => setCleanedAt(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">作業内容</label>
            <input
              type="text"
              value={workContent}
              onChange={(e) => setWorkContent(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">備考</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold text-gray-700">写真の編集</h2>
          {drafts.map((d, i) => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">
                {i + 1}. {d.item_name}
              </h3>
              <div className="flex gap-3 mb-3">
                <PhotoEditor
                  existingUrl={d.before_url}
                  preview={d.before_preview}
                  onChange={(f) => handleFileChange(i, 'before', f)}
                  onRemove={() => removeExistingPhoto(i, 'before')}
                  label="作業前"
                  color="blue"
                />
                <PhotoEditor
                  existingUrl={d.after_url}
                  preview={d.after_preview}
                  onChange={(f) => handleFileChange(i, 'after', f)}
                  onRemove={() => removeExistingPhoto(i, 'after')}
                  label="作業後"
                  color="green"
                />
              </div>
              <input
                type="text"
                value={d.item_notes}
                onChange={(e) => setDrafts((prev) =>
                  prev.map((dd, idx) => idx === i ? { ...dd, item_notes: e.target.value } : dd)
                )}
                placeholder="この項目の備考（任意）"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white rounded-xl py-4 font-semibold text-base hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? '保存中...' : <><CheckCircle size={20} /> 変更を保存</>}
        </button>
      </form>
    </div>
  )
}
