'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CleaningReport, Property, ReportItem } from '@/lib/types'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Camera, Image as ImageIcon, X, CheckCircle, Pencil, Check, Trash2, ChevronUp, ChevronDown, Plus } from 'lucide-react'
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

// 写真エディタ（label ベースで iOS Safari でも安定動作）
let __editorCounter = 0
function PhotoEditor({
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
}) {
  const idRef = useRef<string>('')
  if (!idRef.current) {
    __editorCounter += 1
    idRef.current = `pe_${__editorCounter}`
  }
  const cameraId = `${idRef.current}_cam`
  const albumId = `${idRef.current}_alb`

  const showImg = preview || existingUrl
  const colorClass =
    color === 'blue' ? 'border-blue-200 text-blue-600' : 'border-green-200 text-green-600'

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onChange(f)
    e.target.value = ''
  }

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
            <label
              htmlFor={cameraId}
              className="flex-1 text-xs py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1 cursor-pointer"
            >
              <Camera size={12} /> 撮り直し
            </label>
            <label
              htmlFor={albumId}
              className="flex-1 text-xs py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1 cursor-pointer"
            >
              <ImageIcon size={12} /> 選び直し
            </label>
          </div>
        </div>
      ) : (
        <div className={`w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-stretch p-2 gap-1 ${colorClass}`}>
          <label
            htmlFor={cameraId}
            className="flex-1 flex items-center justify-center gap-1 text-xs bg-white rounded hover:bg-gray-50 cursor-pointer"
          >
            <Camera size={16} /> カメラで撮影
          </label>
          <label
            htmlFor={albumId}
            className="flex-1 flex items-center justify-center gap-1 text-xs bg-white rounded hover:bg-gray-50 cursor-pointer"
          >
            <ImageIcon size={16} /> アルバムから選択
          </label>
        </div>
      )}
      <input
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInput}
      />
      <input
        id={albumId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInput}
      />
    </div>
  )
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
  // 削除した既存 report_items の ID を保持（保存時にDBから削除する）
  const [removedItemIds, setRemovedItemIds] = useState<string[]>([])
  // 項目編集用
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newItemName, setNewItemName] = useState('')

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
    // 1. まず先に元ファイルで即時セット（圧縮中に消えても写真は確実に反映）
    const initialPreview = URL.createObjectURL(file)
    setDrafts((prev) => prev.map((d, i) =>
      i === index
        ? { ...d, [`${type}_file`]: file, [`${type}_preview`]: initialPreview }
        : d
    ))

    // 2. その後、圧縮を試みて成功したら差し替え
    try {
      const compressed = await compressImage(file, { maxWidth: 1600, quality: 0.8 })
      if (compressed === file) return
      const preview = URL.createObjectURL(compressed)
      setDrafts((prev) => prev.map((d, i) =>
        i === index
          ? { ...d, [`${type}_file`]: compressed, [`${type}_preview`]: preview }
          : d
      ))
    } catch (err) {
      console.error('圧縮失敗 - 元ファイルを使用:', err)
    }
  }

  const removeExistingPhoto = (index: number, type: 'before' | 'after') => {
    setDrafts((prev) => prev.map((d, i) =>
      i === index
        ? { ...d, [`${type}_url`]: null, [`${type}_file`]: null, [`${type}_preview`]: null }
        : d
    ))
  }

  // 撮影項目を追加（保存時にDBへinsert）
  const handleAddItem = () => {
    if (!newItemName.trim()) return
    setDrafts((prev) => [
      ...prev,
      {
        // 一時ID: tmp_ プレフィックスで新規と既存を区別
        id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        item_name: newItemName.trim(),
        before_url: null,
        after_url: null,
        before_file: null,
        after_file: null,
        before_preview: null,
        after_preview: null,
        item_notes: '',
      },
    ])
    setNewItemName('')
  }

  // 撮影項目を削除（保存時にDBから削除）
  const handleDeleteItem = (index: number) => {
    const draft = drafts[index]
    if (!confirm(`「${draft.item_name}」をこの報告書から削除しますか？`)) return
    // 既存項目（tmp_ プレフィックスがない）は削除リストに追加
    if (!draft.id.startsWith('tmp_')) {
      setRemovedItemIds((prev) => [...prev, draft.id])
    }
    setDrafts((prev) => prev.filter((_, i) => i !== index))
  }

  // 項目名の編集
  const startEditItem = (id: string, name: string) => {
    setEditingItemId(id)
    setEditingName(name)
  }

  const cancelEditItem = () => {
    setEditingItemId(null)
    setEditingName('')
  }

  const saveEditItem = () => {
    if (!editingItemId || !editingName.trim()) return
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === editingItemId ? { ...d, item_name: editingName.trim() } : d
      )
    )
    setEditingItemId(null)
    setEditingName('')
  }

  // 項目の並び替え（ローカルのみ。保存時にsort_orderを再計算）
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= drafts.length) return
    const newDrafts = [...drafts]
    ;[newDrafts[index], newDrafts[newIndex]] = [newDrafts[newIndex], newDrafts[index]]
    setDrafts(newDrafts)
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

      // 削除された既存項目を report_items から削除
      if (removedItemIds.length > 0) {
        await supabase
          .from('report_items')
          .delete()
          .in('id', removedItemIds)
      }

      // 各項目を保存（既存はupdate、新規はinsert、sort_orderも反映）
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

        if (d.id.startsWith('tmp_')) {
          // 新規追加項目: insert
          await supabase.from('report_items').insert({
            report_id: id,
            inspection_item_id: null,
            item_name: d.item_name,
            before_photo_url: beforeUrl,
            after_photo_url: afterUrl,
            item_notes: d.item_notes || null,
            sort_order: i,
          })
        } else {
          // 既存項目: update
          await supabase.from('report_items').update({
            item_name: d.item_name,
            before_photo_url: beforeUrl,
            after_photo_url: afterUrl,
            item_notes: d.item_notes || null,
            sort_order: i,
          }).eq('id', d.id)
        }
      }

      // 更新後の内容で Google Drive の PDF を再アップロード（バックグラウンド）
      fetch('/api/save-pdf-to-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id }),
        keepalive: true,
      }).catch((e) => console.error('Drive upload failed:', e))

      router.push(`/reports/${id}`)
    } catch (err) {
      alert('保存中にエラーが発生しました。')
      console.error(err)
    }
    setSaving(false)
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
          <h2 className="font-semibold text-gray-700">撮影項目・写真の編集</h2>
          {drafts.map((d, i) => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              {/* 項目名と編集・並び替えコントロール */}
              <div className="flex items-center gap-1 mb-3 pb-2 border-b border-gray-100">
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
                    disabled={i === drafts.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 p-0.5"
                    aria-label="下へ"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <span className="text-gray-500 text-sm w-6 text-right">{i + 1}.</span>

                {editingItemId === d.id ? (
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
                    <h3 className="flex-1 font-semibold text-gray-800">{d.item_name}</h3>
                    <button
                      type="button"
                      onClick={() => startEditItem(d.id, d.item_name)}
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

        {/* 撮影項目を追加するフォーム */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-sm text-gray-500 mb-2">
            この報告書に項目を追加（マスタには影響しません）
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
              disabled={!newItemName.trim()}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              <Plus size={16} /> 追加
            </button>
          </div>
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
