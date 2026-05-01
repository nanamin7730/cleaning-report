'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/lib/useAdmin'
import { ShieldAlert, HardDrive, Trash2, RefreshCw, AlertTriangle, Info } from 'lucide-react'

type Stats = {
  totalReports: number
  totalItems: number
  oldReportsCount: number
  oldPhotosCount: number
  thresholdDate: string
  retentionMonths: number
  estimatedSizeMB: number
  storage: {
    usedBytes: number
    usedMB: number
    limitMB: number
    usagePercent: number
    fileCount: number
  }
}

export default function StoragePage() {
  const { isAdmin, loading: adminLoading } = useAdmin()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)

  const fetchStats = async () => {
    setLoading(true)
    const res = await fetch('/api/storage-stats')
    const data = await res.json()
    setStats(data)
    setLoading(false)
  }

  useEffect(() => {
    if (!adminLoading && isAdmin) fetchStats()
  }, [adminLoading, isAdmin])

  const handleManualCleanup = async () => {
    if (!stats) return
    if (
      !confirm(
        `${stats.retentionMonths}ヶ月以上前（${stats.thresholdDate}より前）の写真を削除します。\n\n対象: ${stats.oldReportsCount}件の報告書 / 約${stats.oldPhotosCount}枚の写真\n\n※ PDFはGoogle Driveに保存済みなので、データは消えません。\n※ 報告書のレコード自体は残ります。\n\n本当に実行しますか？`
      )
    )
      return
    setCleaning(true)
    try {
      const res = await fetch('/api/cleanup-old-photos', { method: 'POST' })
      const data = await res.json()
      alert(`削除完了：${data.deletedFileCount}枚の写真を削除しました`)
      await fetchStats()
    } catch (err) {
      alert('削除中にエラーが発生しました')
      console.error(err)
    }
    setCleaning(false)
  }

  if (adminLoading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <ShieldAlert size={48} className="mx-auto mb-4 text-red-300" />
        <p className="text-gray-500 font-medium">このページは管理者のみアクセスできます</p>
      </div>
    )
  }
  if (loading || !stats) return <div className="text-center py-12 text-gray-400">統計を計算中...（少し時間がかかります）</div>

  const { storage } = stats
  const isWarning = storage.usagePercent >= 70
  const isDanger = storage.usagePercent >= 90

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <HardDrive size={22} /> ストレージ管理
      </h1>

      {/* 自動削除の説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800 flex gap-3">
        <Info size={20} className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">自動削除について</p>
          <p>毎日深夜（日本時間 3時）にチェックし、ストレージが <b>80%</b> を超えていたら、古い写真から順に <b>70%</b> まで戻るよう自動削除します。</p>
          <p className="mt-1">※ 削除されるのは写真だけで、報告書のレコードは残ります（PDFはDriveに保存済み）。</p>
        </div>
      </div>

      {/* ストレージ使用状況 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">使用状況</h2>
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-3xl font-bold text-gray-800">
              {storage.usedMB} <span className="text-base font-normal text-gray-500">MB</span>
            </span>
            <span className={`text-sm font-medium ${
              isDanger ? 'text-red-600' : isWarning ? 'text-orange-500' : 'text-gray-500'
            }`}>
              {storage.usagePercent}% / {storage.limitMB} MB
            </span>
          </div>
          {/* 使用率バー */}
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all ${
                isDanger ? 'bg-red-500' : isWarning ? 'bg-orange-400' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(storage.usagePercent, 100)}%` }}
            />
          </div>
          {/* 80% / 70% のマーカー */}
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0%</span>
            <span>70%（戻す目標）</span>
            <span>80%（削除トリガー）</span>
            <span>100%</span>
          </div>
        </div>

        {isDanger && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4 flex gap-2 text-sm text-red-700">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
            <p>容量が逼迫しています。次回の自動チェックで削除が実行されます。今すぐ手動で削除も可能です。</p>
          </div>
        )}
        {isWarning && !isDanger && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4 flex gap-2 text-sm text-orange-700">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
            <p>そろそろ容量に注意が必要です。</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-gray-500">写真ファイル数</p>
            <p className="font-semibold text-gray-800">{storage.fileCount} 枚</p>
          </div>
          <div>
            <p className="text-gray-500">報告書総数</p>
            <p className="font-semibold text-gray-800">{stats.totalReports} 件</p>
          </div>
        </div>
      </div>

      {/* 手動削除セクション */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-2">古い写真を手動削除</h2>
        <p className="text-sm text-gray-500 mb-4">
          {stats.retentionMonths}ヶ月以上前（{stats.thresholdDate} より前）の写真をまとめて削除できます。
        </p>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-gray-600">対象の報告書</span>
            <span className="font-semibold">{stats.oldReportsCount} 件</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-600">削除可能な写真</span>
            <span className="font-semibold">約 {stats.oldPhotosCount} 枚</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">推定削除サイズ</span>
            <span className="font-semibold">約 {stats.estimatedSizeMB} MB</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleManualCleanup}
            disabled={cleaning || stats.oldReportsCount === 0}
            className="flex-1 bg-red-500 text-white rounded-lg py-2.5 font-medium hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            {cleaning ? '削除中...' : '古い写真を削除'}
          </button>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1"
          >
            <RefreshCw size={14} /> 更新
          </button>
        </div>
      </div>
    </div>
  )
}
