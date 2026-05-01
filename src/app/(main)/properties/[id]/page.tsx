'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Property, InspectionItem } from '@/lib/types'
import { useParams, useRouter } from 'next/navigation'
import { Plus, GripVertical, Trash2, ChevronLeft, Settings } from 'lucide-react'

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [property, setProperty] = useState<Property | null>(null)
  const [items, setItems] = useState<InspectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItemName, setNewItemName] = useState('')
  const [adding, setAdding] = useState(false)

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

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  if (!property) return <div className="text-center py-12 text-gray-400">物件が見つかりません</div>

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 text-sm"
      >
        <ChevronLeft size={18} /> 物件一覧へ戻る
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
                className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100"
              >
                <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
                <span className="text-gray-500 text-sm w-5">{i + 1}.</span>
                <span className="flex-1 font-medium text-gray-800">{item.name}</span>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
