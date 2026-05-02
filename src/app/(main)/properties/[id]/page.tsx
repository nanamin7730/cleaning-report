'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Property, InspectionItem } from '@/lib/types'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronLeft, Settings, ChevronUp, ChevronDown, Pencil, Check, X } from 'lucide-react'

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [property, setProperty] = useState<Property | null>(null)
  const [items, setItems] = useState<InspectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItemName, setNewItemName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const fetchData = async () => {
    const [{ data: prop }, { data: itemsData }] = await Promise.all([
      supabase.from('properties').select('*').eq('id', id).single(),
      supabase.from('inspection_items').select('*').eq('property_id', id).order('sort_order'),
    ])
    setProperty(prop)
    setItems(itemsData ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim()) return
    setAdding(true)
    await supabase.from('inspection_items').insert({
      property_id: id,
      name: newItemName.trim(),
      sort_order: items.length,
    })
    setNewItemName('')
    setAdding(false)
    fetchData()
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('この撮影項目を削除しますか？')) return
    await supabase.from('inspection_items').delete().eq('id', itemId)
    fetchData()
  }

  const startEdit = (item: InspectionItem) => {
    setEditingId(item.id)
    setEditingName(item.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return
    await supabase
      .from('inspection_items')
      .update({ name: editingName.trim() })
      .eq('id', editingId)
    setEditingId(null)
    setEditingName('')
    fetchData()
  }

  // 順番を入れ替え（隣接アイテムと sort_order を交換）
  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= items.length) return

    const a = items[index]
    const b = items[newIndex]

    // 楽観的UI更新（即座に並び替え）
    const newItems = [...items]
    newItems[index] = { ...b, sort_order: a.sort_order }
    newItems[newIndex] = { ...a, sort_order: b.sort_order }
    setItems(newItems)

    // DB更新（unique制約はないが、順序を確実に入れ替える）
    await supabase.from('inspection_items').update({ sort_order: -1 }).eq('id', a.id)
    await supabase.from('inspection_items').update({ sort_order: a.sort_order }).eq('id', b.id)
    await supabase.from('inspection_items').update({ sort_order: b.sort_order }).eq('id', a.id)

    fetchData()
  }

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  if (!property) return <div className="text-center py-12 text-gray-400">物件が見つかりません</div>

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 text-sm"
      >
        <ChevronLeft size={18} /> 戻る
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-800">{property.name}</h1>
        <p className="text-gray-500 mt-1">{property.address}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Settings size={18} /> 撮影項目の設定
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          清掃時に写真を撮る場所・項目を登録してください。
          例：玄関、リビング、キッチン、トイレ、浴室、など
        </p>

        <form onSubmit={handleAddItem} className="flex gap-2 mb-5">
          <input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="項目名を入力（例：玄関）"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={adding || !newItemName.trim()}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            <Plus size={16} /> 追加
          </button>
        </form>

        {items.length === 0 ? (
          <p className="text-center text-gray-400 py-6 text-sm">
            撮影項目がまだありません。上のフォームから追加してください。
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li
                key={item.id}
                className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-2 border border-gray-100"
              >
                {/* 並び替えボタン */}
                <div className="flex flex-col">
                  <button
                    onClick={() => moveItem(i, 'up')}
                    disabled={i === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:hover:text-gray-400 p-0.5"
                    aria-label="上へ"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => moveItem(i, 'down')}
                    disabled={i === items.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:hover:text-gray-400 p-0.5"
                    aria-label="下へ"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                <span className="text-gray-500 text-sm w-6 text-right">{i + 1}.</span>

                {/* 名前（編集中はinput、それ以外はテキスト） */}
                {editingId === item.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    autoFocus
                    className="flex-1 border border-blue-300 rounded px-2 py-1 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <span className="flex-1 font-medium text-gray-800">{item.name}</span>
                )}

                {/* アクションボタン */}
                {editingId === item.id ? (
                  <>
                    <button
                      onClick={saveEdit}
                      className="text-green-500 hover:text-green-700 p-1"
                      aria-label="保存"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-gray-400 hover:text-gray-700 p-1"
                      aria-label="キャンセル"
                    >
                      <X size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(item)}
                      className="text-gray-400 hover:text-blue-600 p-1"
                      aria-label="編集"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-red-400 hover:text-red-600 p-1"
                      aria-label="削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
