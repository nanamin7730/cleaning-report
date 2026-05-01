'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Property } from '@/lib/types'
import Link from 'next/link'
import { Plus, Building2, ChevronRight, Trash2, ShieldAlert } from 'lucide-react'
import { useAdmin } from '@/lib/useAdmin'

export default function PropertiesPage() {
  const supabase = createClient()
  const { isAdmin, loading: adminLoading } = useAdmin()

  if (!adminLoading && !isAdmin) {
    return (
      <div className="text-center py-20">
        <ShieldAlert size={48} className="mx-auto mb-4 text-red-300" />
        <p className="text-gray-500 font-medium">このページは管理者のみアクセスできます</p>
      </div>
    )
  }
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchProperties = async () => {
    const { data } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false })
    setProperties(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchProperties() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('properties').insert({
      name: name.trim(),
      address: address.trim(),
      created_by: user?.id,
    })
    setName('')
    setAddress('')
    setShowForm(false)
    setSaving(false)
    fetchProperties()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この物件を削除しますか？\n（関連する報告書もすべて削除されます）')) return
    await supabase.from('properties').delete().eq('id', id)
    fetchProperties()
  }

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Building2 size={22} /> 物件管理
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> 物件追加
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-4">新しい物件を追加</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">物件名 *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="例：グリーンマンション101"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">住所 *</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                placeholder="例：東京都渋谷区〇〇1-2-3"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2.5 font-medium"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {properties.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>物件が登録されていません</p>
          <p className="text-sm mt-1">「物件追加」ボタンから追加してください</p>
        </div>
      ) : (
        <div className="space-y-3">
          {properties.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <Link href={`/properties/${p.id}`} className="flex items-center p-4 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                  <p className="text-sm text-gray-500 truncate mt-0.5">{p.address}</p>
                </div>
                <ChevronRight size={18} className="text-gray-400 ml-2 flex-shrink-0" />
              </Link>
              <div className="border-t border-gray-100 px-4 py-2 flex justify-end">
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-red-400 hover:text-red-600 text-sm flex items-center gap-1"
                >
                  <Trash2 size={14} /> 削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
