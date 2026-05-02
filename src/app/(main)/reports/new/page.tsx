'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Property, InspectionItem } from '@/lib/types'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Camera, Image as ImageIcon, X, CheckCircle, Pencil, Check, Trash2, ChevronUp, ChevronDown, Plus } from 'lucide-react'
import Image from 'next/image'
import { compressImage } from '@/lib/compressImage'

type ItemDraft = {
  // 一時ID（React のキー用）。DBの inspection_items.id ではない
  draft_id: string
  // マスタの inspection_items.id（新規追加項目は null）
  inspection_item_id: string | null
  item_name: string
  before_file: File | null
  before_preview: string | null
  after_file: File | null
  after_preview: string | null
  item_notes: string
}

function NewReportInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPropertyId = searchParams.get('propertyId') ?? ''
  const supabase = createClient()
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState(initialPropertyId)
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([])
  const [cleanedAt, setCleanedAt] = useState(new Date().toISOString().split('T')[0])
  const [workContent, setWorkContent] = useState('掃き拭き掃除')
  const [notes, setNotes] = useState('')
  const [itemDrafts, setItemDrafts] = useState<ItemDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  useEffect(() => {
    supabase.from('properties').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        setProperties(data ?? [])
        if (initialPropertyId) {
          loadInspectionItems(initialPropertyId)
        }
      })
  }, [])

  const loadInspectionItems = async (propId: string) => {
    const { data } = await supabase
      .from('inspection_items')
      .select('*')
      .eq('property_id', propId)
      .order('sort_order')
    const items = data ?? []
    setInspectionItems(items)
    setItemDrafts(items.map((item) => ({
      draft_id: item.id,
      inspection_item_id: item.id,
      item_name: item.name,
      before_file: null,
      before_preview: null,
      after_file: null,
      after_preview: null,
      item_notes: '',
    })))
  }

  const handlePropertyChange = async (propId: string) => {
    setSelectedPropertyId(propId)
    if (propId) await loadInspectionItems(propId)
  }

  const handleFileChange = async (
    index: number,
    type: 'before' | 'after',
    file: File | null
  ) => {
    if (!file) return
    // 圧縮
    const compressed = await compressImage(file, { maxWidth: 1600, quality: 0.8 })
    const preview = URL.createObjectURL(compressed)
    setItemDrafts((prev) => prev.map((d, i) =>
      i === index
        ? { ...d, [`${type}_file`]: compressed, [`${type}_preview`]: preview }
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

  // 撮影項目の追加（この報告書のみに反映、マスタには影響しない）
  const handleAddItem = () => {
    if (!newItemName.trim()) return
    setAddingItem(true)
    setItemDrafts((prev) => [
      ...prev,
      {
        draft_id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        inspection_item_id: null,
        item_name: newItemName.trim(),
        before_file: null,
        before_preview: null,
        after_file: null,
        after_preview: null,
        item_notes: '',
      },
    ])
    setNewItemName('')
    setAddingItem(false)
  }

  // 撮影項目の削除（この報告書のみに反映、マスタには影響しない）
  const handleDeleteItem = (index: number) => {
    const draft = itemDrafts[index]
    if (!confirm(`「${draft.item_name}」をこの報告書から外しますか？\n（マスタの撮影項目には影響しません）`)) return
    setItemDrafts((prev) => prev.filter((_, i) => i !== index))
  }

  // 撮影項目名の編集開始
  const startEditItem = (draftId: string, name: string) => {
    setEditingItemId(draftId)
    setEditingName(name)
  }

  const cancelEditItem = () => {
    setEditingItemId(null)
    setEditingName('')
  }

  // 編集確定（ローカルだけ更新、マスタには影響しない）
  const saveEditItem = () => {
    if (!editingItemId || !editingName.trim()) return
    setItemDrafts((prev) =>
      prev.map((d) =>
        d.draft_id === editingItemId
          ? { ...d, item_name: editingName.trim() }
          : d
      )
    )
    setEditingItemId(null)
    setEditingName('')
  }

  // 撮影項目の並び替え（ローカルだけ更新、マスタには影響しない）
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= itemDrafts.length) return
    const newDrafts = [...itemDrafts]
    ;[newDrafts[index], newDrafts[newIndex]] = [newDrafts[newIndex], newDrafts[index]]
    setItemDrafts(newDrafts)
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

      // Google Drive へ PDF を自動アップロード（バックグラウンド）
      // 失敗してもユーザー体験を妨げないよう、エラーは握りつぶしてログだけ出す
      fetch('/api/save-pdf-to-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      }).catch((e) => console.error('Drive upload failed:', e))

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
    const cameraRef = useRef<HTMLInputElement>(null)
    const albumRef = useRef<HTMLInputElement>(null)
    const colorClass = color === 'blue'
      ? 'border-blue-200 text-blue-600'
      : 'border-green-200 text-green-600'

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
        {/* カメラ用 */}
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
        {/* アルバム用 */}
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
              <div key={draft.draft_id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                {/* 項目名と編集・並び替えコントロール */}
                <div className="flex items-center gap-1 mb-3 pb-2 border-b border-gray-100">
                  {/* 並び替えボタン */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveItem(i, 'up')}
                      disabled={i === 0}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20 p-0.5"
                      aria-label="上へ"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(i, 'down')}
                      disabled={i === itemDrafts.length - 1}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20 p-0.5"
                      aria-label="下へ"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  <span className="text-gray-500 text-sm w-6 text-right">{i + 1}.</span>

                  {editingItemId === draft.draft_id ? (
                    <>
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            saveEditItem()
                          }
                          if (e.key === 'Escape') cancelEditItem()
                        }}
                        autoFocus
                        className="flex-1 border border-blue-300 rounded px-2 py-1 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={saveEditItem}
                        className="text-green-500 hover:text-green-700 p-1"
                        aria-label="保存"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditItem}
                        className="text-gray-400 hover:text-gray-700 p-1"
                        aria-label="キャンセル"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <h3 className="flex-1 font-semibold text-gray-800">{draft.item_name}</h3>
                      <button
                        type="button"
                        onClick={() => startEditItem(draft.draft_id, draft.item_name)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                        aria-label="編集"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(i)}
                        className="text-red-400 hover:text-red-600 p-1"
                        aria-label="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex gap-3 mb-3">
                  <PhotoUploader
                    preview={draft.before_preview}
                    onChange={(f) => handleFileChange(i, 'before', f)}
                    onClear={() => clearPhoto(i, 'before')}
                    label="作業前"
                    color="blue"
                  />
                  <PhotoUploader
                    preview={draft.after_preview}
                    onChange={(f) => handleFileChange(i, 'after', f)}
                    onClear={() => clearPhoto(i, 'after')}
                    label="作業後"
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

        {/* 撮影項目を追加するフォーム（物件選択後に常に表示） */}
        {selectedPropertyId && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-sm text-gray-500 mb-2">
              この報告書だけに撮影項目を追加（マスタには影響しません）
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddItem()
                  }
                }}
                placeholder="項目名を入力（例：玄関）"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddItem}
                disabled={addingItem || !newItemName.trim()}
                className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                <Plus size={16} /> 追加
              </button>
            </div>
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

export default function NewReportPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">読み込み中...</div>}>
      <NewReportInner />
    </Suspense>
  )
}
