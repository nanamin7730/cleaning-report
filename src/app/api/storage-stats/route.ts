import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 保持期間（環境変数で上書き可、デフォルト3ヶ月）
  const retentionMonths = parseInt(process.env.PHOTO_RETENTION_MONTHS || '3', 10)
  const threshold = new Date()
  threshold.setMonth(threshold.getMonth() - retentionMonths)
  const thresholdDate = threshold.toISOString().split('T')[0]

  // 全報告書数
  const { count: totalReports } = await supabase
    .from('cleaning_reports')
    .select('*', { count: 'exact', head: true })

  // 保持期間より古い報告書
  const { data: oldReports, count: oldReportsCount } = await supabase
    .from('cleaning_reports')
    .select('id', { count: 'exact' })
    .lt('cleaned_at', thresholdDate)

  // 削除可能な写真数を数える
  const oldReportIds = oldReports?.map((r) => r.id) || []
  let oldPhotosCount = 0
  if (oldReportIds.length > 0) {
    // 一度に多すぎないようにバッチ処理
    const batchSize = 200
    for (let i = 0; i < oldReportIds.length; i += batchSize) {
      const batch = oldReportIds.slice(i, i + batchSize)
      const { data: items } = await supabase
        .from('report_items')
        .select('before_photo_url, after_photo_url')
        .in('report_id', batch)
      for (const item of items || []) {
        if (item.before_photo_url) oldPhotosCount++
        if (item.after_photo_url) oldPhotosCount++
      }
    }
  }

  // 全体の写真数（参考用）
  const { count: totalItemsCount } = await supabase
    .from('report_items')
    .select('*', { count: 'exact', head: true })

  // ストレージ使用量を計算（フォルダごとに list して size を合計）
  let usedBytes = 0
  let fileCount = 0
  const { data: rootFolders } = await supabase.storage
    .from('report-photos')
    .list('', { limit: 10000 })

  for (const folder of rootFolders || []) {
    if (!folder.name || folder.id) continue // ファイルはスキップ、フォルダのみ
    const { data: files } = await supabase.storage
      .from('report-photos')
      .list(folder.name, { limit: 10000 })
    for (const file of files || []) {
      usedBytes += (file.metadata?.size as number) || 0
      fileCount++
    }
  }

  const limitBytes = 1024 * 1024 * 1024 // 1GB
  const usagePercent = Math.round(((usedBytes / limitBytes) * 100) * 10) / 10

  return NextResponse.json({
    totalReports: totalReports ?? 0,
    totalItems: totalItemsCount ?? 0,
    oldReportsCount: oldReportsCount ?? 0,
    oldPhotosCount,
    thresholdDate,
    retentionMonths,
    estimatedSizeMB: Math.round((oldPhotosCount * 0.3) * 10) / 10,
    storage: {
      usedBytes,
      usedMB: Math.round((usedBytes / 1024 / 1024) * 10) / 10,
      limitMB: 1024,
      usagePercent,
      fileCount,
    },
  })
}
