import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import { Readable } from 'stream'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function escapeHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function buildHtml(report: any): string {
  const items = (report.report_items || [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((item: any) => `
      <div class="pdf-item">
        <div class="pdf-item-header">【${escapeHtml(item.item_name)}】</div>
        <table class="pdf-item-table">
          <thead>
            <tr>
              <th>作業前</th>
              <th>作業後</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="pdf-photo-cell">
                ${item.before_photo_url
                  ? `<img src="${escapeHtml(item.before_photo_url)}" />`
                  : `<div class="empty">写真なし</div>`}
              </td>
              <td class="pdf-photo-cell">
                ${item.after_photo_url
                  ? `<img src="${escapeHtml(item.after_photo_url)}" />`
                  : `<div class="empty">写真なし</div>`}
              </td>
            </tr>
          </tbody>
        </table>
        ${item.item_notes
          ? `<div class="pdf-notes">${escapeHtml(item.item_notes)}</div>`
          : ''}
      </div>
    `).join('')

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>清掃報告書</title>
  <style>
    @page { margin: 8mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Noto Sans JP', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN',
        'Yu Gothic', YuGothic, Meiryo, sans-serif;
      font-size: 10pt;
      margin: 0;
      padding: 0;
      color: #111;
    }
    .pdf-title {
      text-align: center;
      font-size: 13pt;
      font-weight: bold;
      margin: 0 0 4mm 0;
    }
    .pdf-header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4mm;
    }
    .pdf-header-table th, .pdf-header-table td {
      border: 1px solid #444;
      padding: 1.5mm 2mm;
      vertical-align: middle;
    }
    .pdf-header-table th {
      background: #f3f4f6;
      text-align: left;
      font-weight: 600;
      width: 22mm;
    }
    .pdf-item {
      margin-bottom: 2mm;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .pdf-item-header {
      background: #D9E8F5;
      border: 1px solid #444;
      padding: 1.5mm 2mm;
      font-weight: 600;
      font-size: 10pt;
    }
    .pdf-item-table {
      width: 100%;
      border-collapse: collapse;
    }
    .pdf-item-table th {
      background: #e5e7eb;
      border: 1px solid #444;
      padding: 1mm 2mm;
      font-weight: 600;
      width: 50%;
    }
    .pdf-photo-cell {
      border: 1px solid #444;
      padding: 1mm;
      vertical-align: top;
      width: 50%;
    }
    .pdf-photo-cell img {
      width: 100%;
      height: 42mm;
      object-fit: contain;
      display: block;
    }
    .pdf-photo-cell .empty {
      width: 100%;
      height: 42mm;
      background: #f9fafb;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
      font-size: 8pt;
    }
    .pdf-notes {
      border: 1px solid #444;
      border-top: 0;
      background: #f9fafb;
      padding: 1.5mm 2mm;
      font-size: 8pt;
      color: #444;
    }
  </style>
</head>
<body>
  <h1 class="pdf-title">■ 日常清掃報告書 ■</h1>
  <table class="pdf-header-table">
    <tr>
      <th>物件名</th>
      <td colspan="3">${escapeHtml(report.properties?.name)}</td>
    </tr>
    <tr>
      <th>所在地</th>
      <td>${escapeHtml(report.properties?.address)}</td>
      <th>作業内容</th>
      <td>${escapeHtml(report.work_content || '掃き拭き掃除')}</td>
    </tr>
    <tr>
      <th>作業日時</th>
      <td colspan="3">${formatDate(report.cleaned_at)}</td>
    </tr>
  </table>
  ${items}
  ${report.notes ? `
    <div class="pdf-item">
      <div class="pdf-item-header">【備考】</div>
      <div class="pdf-notes" style="border-top: 1px solid #444;">${escapeHtml(report.notes)}</div>
    </div>
  ` : ''}
</body>
</html>`
}

async function ensureFolder(drive: any, name: string, parentId: string): Promise<string> {
  // 既存フォルダを検索
  const safeName = name.replace(/'/g, "\\'")
  const res = await drive.files.list({
    q: `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }
  // 新規作成
  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  return folder.data.id!
}

export async function POST(req: NextRequest) {
  try {
    const { reportId } = await req.json()
    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
    }

    // 1. 報告書データを取得
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: report, error } = await supabase
      .from('cleaning_reports')
      .select('*, properties(*), report_items(*)')
      .eq('id', reportId)
      .single()

    if (error || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // 2. PDF を生成（puppeteer + chromium）
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = await import('puppeteer-core')

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
    const page = await browser.newPage()
    await page.setContent(buildHtml(report), { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
    })
    await browser.close()

    // 3. Google Drive にアップロード
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!),
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
    const drive = google.drive({ version: 'v3', auth })

    const date = new Date(report.cleaned_at)
    const yearMonth = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`
    const propertyName = (report as any).properties?.name ?? '不明物件'

    const yearFolderId = await ensureFolder(drive, yearMonth, process.env.GOOGLE_DRIVE_FOLDER_ID!)
    const propertyFolderId = await ensureFolder(drive, propertyName, yearFolderId)

    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const fileName = `${yyyy}-${mm}-${dd}_${propertyName}.pdf`

    const uploadRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [propertyFolderId],
        mimeType: 'application/pdf',
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(Buffer.from(pdfBuffer)),
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })

    return NextResponse.json({
      success: true,
      fileId: uploadRes.data.id,
      webViewLink: uploadRes.data.webViewLink,
      fileName,
    })
  } catch (err: any) {
    console.error('PDF upload error:', err)
    return NextResponse.json(
      { error: err.message || 'PDF生成・アップロードに失敗しました' },
      { status: 500 }
    )
  }
}
