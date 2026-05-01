'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Property, InspectionItem } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Camera, Upload, X, CheckCircle } from 'lucide-react'
import Image from 'next/image'

type ItemDraft = {
  inspection_item_id: string
  item_name: string
  before_file: File | null
  before_preview: string | null
  after_file: File | null
  after_preview: string | null
  item_notes: string
}

export default function NewReportPage() {
  const router = useRouter()
  const supabase = createClient()
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([])
  const [cleanedAt, setCleanedAt] = useState(new Date().toISOString().split('T')[0])
  const [workContent, setWorkContent] = useState('掃き拭き掃除')
  const [notes, setNotes] = useState('')
  const [itemDrafts, setItemDrafts] = useState<ItemDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'select' | 'photos'>('select')

  useEffect(() => {
    supabase.from('properties').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setProperties(data ?? []))
  }, [])

  const handlePropertyChange = async (propId: string) => {
    setSelectedPropertyId(propId)
    const { data } = await supabase
      .from('inspection_items')
      .select('*')
      .eq('property_id', propId)
      .order('sort_order')
    const items = data ?? []
    setInspectionItems(items)
    setItemDrafts(items.map((item) => ({
      inspection_item_id: item.id,
      item_name: item.name,
      before_file: null,
      before_preview: null,
      after_file: null,
      after_preview: null,
      item_notes: '',
    })))
  }

  const handleFileChange = (
    index: number,
    type: 'before' | 'after',
    file: File | null
  ) => {
    if (!file) return
    const preview = URL.createObjectURL(file)
    setItemDrafts((prev) => prev.map((d, i) =>
      i === index
        ? { ...d, [`${type}_file`]: file, [`${type}_preview`]: preview }
        : d
    ))
  }

  const clearPhoto = (index: number, type: 'before' | 'after') => {
    setItemDrafts((prev) => prev.map((d, i) =>
      i === index
        ? { ...d, [`${type}_file`]: null, [`${type}_preview`]: null }
        : d
    ))
  }

  const uploadPhoto = async (file: File, path: string) => {
    const { data, error } = await supabase.storage
      .from('report-photos')
      .upload(path, file, { upsert: true })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('report-photos').getPublicUrl(path)
    return publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPropertyId) return
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: report, error: reportError } = await supabase
        .from('cleaning_reports')
        .insert({
          property_id: selectedPropertyId,
          cleaned_at: cleanedAt,
          work_content: workContent || null,
          notes: notes || null,
          created_by: user?.id,
        })
        .select()
        .single()

      if (reportError || !report) throw reportError

      const reportId = report.id
      const timestamp = Date.now()

      for (let i = 0; i < itemDrafts.length; i++) {
        const draft = itemDrafts[i]
        let beforeUrl: string | null = null
        let afterUrl: string | null = null

        if (draft.before_file) {
          beforeUrl = await uploadPhoto(
            draft.before_file,
            `${reportId}/${timestamp}_${i}_before.jpg`
          )
        }
        if (draft.after_file) {
          afterUrl = await uploadPhoto(
            draft.after_file,
            `${reportId}/${timestamp}_${i}_after.jpg`
          )
        }

        await supabase.from('report_items').insert({
          report_id: reportId,
          inspection_item_id: draft.inspection_item_id,
          item_name: draft.item_name,
          before_photo_url: beforeUrl,
          after_photo_url: afterUrl,
          item_notes: draft.item_notes || null,
          sort_order: i,
        })
      }

      router.push(`/reports/${reportId}`)
    } catch (err) {
      alert('保存中にエラーが発生しました。もう一度お試しください。')
      console.error(err)
    }
    setSaving(false)
  }

  const PhotoUploader = ({
    preview,
    onChange,
    onClear,
    label,
    color,
  }: {
    preview: string | null
    onChange: (f: File) => void
    onClear: () => void
    label: string
    color: 'blue' | 'green'
  }) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const colorClass = color === 'blue'
      ? 'bg-blue-50 border-blue-200 text-blue-600'
      : 'bg-green-50 border-green-200 text-green-600'

    return (
      <div className="flex-1">
        <p className={`text-xs font-bold mb-1 ${color === 'blue' ? 'text-blue-600' : 'text-green-600'}`}>
          {label}
        </p>
        {preview ? (
          <div className="relative">
            <Image
              src={preview}
              alt={label}
              width={300}
              height={200}
              className="w-full h-32 object-cover rounded-lg border"
            />
            <button
              type="button"
              onClick={onClear}
              className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow"
            >
              <X size={14} className="text-gray-600" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 ${colorClass}`}
          >
            <Camera size={24} />
            <span className="text-xs">写真を選択</span>
          </button>
        )}
        <input
          ref={inputRef}
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
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 text-sm">
        <ChevronLeft size={18} /> 戻る
      </button>
      <h1 className="text-xl font-bold text-gray-800 mb-6">新しい清掃報告書</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本情報 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-700">基本情報</h2>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">物件を選択 *</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => handlePropertyChange(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- 物件を選んでください --</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {properties.length === 0 && (
              <p className="text-sm text-orange-500 mt-1">
                物件が登録されていません。先に「物件」ページで物件を追加してください。
              </p>
            )}
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
              placeholder="例：掃き拭き掃除"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">備考</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="全体的な状況や特記事項など"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* 撮影項目ごとのビフォーアフター */}
        {selectedPropertyId && itemDrafts.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-700">ビフォーアフター写真</h2>
            {itemDrafts.map((draft, i) => (
              <div key={draft.inspection_item_id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-3">
                  {i + 1}. {draft.item_name}
                </h3>
                <div className="flex gap-3 mb-3">
                  <PhotoUploader
                    preview={draft.before_preview}
                    onChange={(f) => handleFileChange(i, 'before', f)}
                    onClear={() => clearPhoto(i, 'before')}
                    label="BEFORE"
                    color="blue"
                  />
                  <PhotoUploader
                    preview={draft.after_preview}
                    onChange={(f) => handleFileChange(i, 'after', f)}
                    onClear={() => clearPhoto(i, 'after')}
                    label="AFTER"
                    color="green"
                  />
                </div>
                <input
                  type="text"
                  value={draft.item_notes}
                  onChange={(e) => setItemDrafts((prev) =>
                    prev.map((d, idx) => idx === i ? { ...d, item_notes: e.target.value } : d)
                  )}
                  placeholder="この項目の備考（任意）"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            ))}
          </div>
        )}

        {selectedPropertyId && inspectionItems.length === 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-700">
            この物件には撮影項目が設定されていません。
            「物件」ページからこの物件の撮影項目を追加してください。
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !selectedPropertyId}
          className="w-full bg-blue-600 text-white rounded-xl py-4 font-semibold text-base hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>アップロード・保存中...</>
          ) : (
            <><CheckCircle size={20} /> 報告書を保存</>
          )}
        </button>
      </form>
    </div>
  )
}
