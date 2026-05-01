import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 1GB（無料プランの上限）
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024
// 80%超えたら削除開始
const TRIGGER_THRESHOLD = 0.8
// 70%まで戻るまで削除を続ける
const TARGET_THRESHOLD = 0.7

type FileInfo = {
  reportId: string
  name: string
  size: number
}

// バケット内の全ファイルを一覧（フォルダごと）
async function listAllFiles(supabase: SupabaseClient): Promise<FileInfo[]> {
  const result: FileInfo[] = []
  // ルート直下のフォルダ（=報告書ID）一覧
  const { data: folders } = await supabase.storage
    .from('report-photos')
    .list('', { limit: 10000 })

  for (const folder of folders || []) {
    // ルート直下のファイル(metadata付き)はスキップ。フォルダだけ処理
    if (!folder.name) continue
    if (folder.id) continue // ファイルは id を持つ。フォルダは null

    const { data: files } = await supabase.storage
      .from('report-photos')
      .list(folder.name, { limit: 10000 })

    for (const file of files || []) {
      const size = (file.metadata?.size as number) || 0
      result.push({
        reportId: folder.name,
        name: file.name,
        size,
      })
    }
  }
  return result
}

async function autoCleanup(supabase: SupabaseClient) {
  // 1. 全ファイルを一覧 + 合計サイズを計算
  const allFiles = await listAllFiles(supabase)
  const totalBytes = allFiles.reduce((sum, f) => sum + f.size, 0)
  const usagePercent = (totalBytes / STORAGE_LIMIT_BYTES) * 100

  // しきい値以下なら何もしない
  if (totalBytes < STORAGE_LIMIT_BYTES * TRIGGER_THRESHOLD) {
    return {
      action: 'skipped',
      usagePercent: Math.round(usagePercent * 10) / 10,
      totalBytes,
      message: `現在 ${Math.round(usagePercent)}% — しきい値（${TRIGGER_THRESHOLD * 100}%）未満なので何もしません`,
    }
  }

  // 2. 古い順に並べ替えるため、報告書を cleaned_at 昇順で取得
  const reportIds = Array.from(new Set(allFiles.map((f) => f.reportId)))
  const { data: reports } = await supabase
    .from('cleaning_reports')
    .select('id, cleaned_at')
    .in('id', reportIds)
    .order('cleaned_at', { ascending: true })

  // 3. 古い報告書から順に写真を削除し、TARGET_THRESHOLD まで戻る
  let currentBytes = totalBytes
  const targetBytes = STORAGE_LIMIT_BYTES * TARGET_THRESHOLD
  let deletedFileCount = 0
  const processedReports: string[] = []
  const errors: string[] = []

  for (const report of reports || []) {
    if (currentBytes < targetBytes) break

    const filesForReport = allFiles.filter((f) => f.reportId === report.id)
    if (filesForReport.length === 0) continue

    const paths = filesForReport.map((f) => `${report.id}/${f.name}`)
    const { error: removeError } = await supabase.storage
      .from('report-photos')
      .remove(paths)

    if (removeError) {
      errors.push(`remove ${report.id}: ${removeError.message}`)
      continue
    }

    // 写真URLをDBから消す
    await supabase
      .from('report_items')
      .update({ before_photo_url: null, after_photo_url: null })
      .eq('report_id', report.id)

    const deletedBytes = filesForReport.reduce((s, f) => s + f.size, 0)
    currentBytes -= deletedBytes
    deletedFileCount += paths.length
    processedReports.push(report.id)
  }

  return {
    action: 'cleaned',
    usagePercentBefore: Math.round(usagePercent * 10) / 10,
    usagePercentAfter:
      Math.round(((currentBytes / STORAGE_LIMIT_BYTES) * 100) * 10) / 10,
    deletedFileCount,
    reportsProcessed: processedReports.length,
    errors: errors.length > 0 ? errors : undefined,
  }
}

// 時間ベースでの手動クリーンアップ（管理画面用）
async function manualCleanup(supabase: SupabaseClient) {
  const retentionMonths = parseInt(
    process.env.PHOTO_RETENTION_MONTHS || '3',
    10
  )
  const threshold = new Date()
  threshold.setMonth(threshold.getMonth() - retentionMonths)
  const thresholdDate = threshold.toISOString().split('T')[0]

  const { data: oldReports } = await supabase
    .from('cleaning_reports')
    .select('id')
    .lt('cleaned_at', thresholdDate)

  let deletedFileCount = 0
  for (const report of oldReports || []) {
    const { data: files } = await supabase.storage
      .from('report-photos')
      .list(report.id, { limit: 1000 })
    if (!files || files.length === 0) continue

    const paths = files.map((f) => `${report.id}/${f.name}`)
    const { error: removeError } = await supabase.storage
      .from('report-photos')
      .remove(paths)
    if (removeError) continue

    await supabase
      .from('report_items')
      .update({ before_photo_url: null, after_photo_url: null })
      .eq('report_id', report.id)

    deletedFileCount += paths.length
  }

  return {
    action: 'manual',
    retentionMonths,
    thresholdDate,
    reportsProcessed: oldReports?.length ?? 0,
    deletedFileCount,
  }
}

// Vercel Cron（GET）— 毎日自動実行用
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await autoCleanup(supabase)
  console.log('[auto-cleanup] result:', result)
  return NextResponse.json({ success: true, ...result })
}

// 管理者画面から手動実行（POST）
export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await manualCleanup(supabase)
  console.log('[manual-cleanup] result:', result)
  return NextResponse.json({ success: true, ...result })
}
