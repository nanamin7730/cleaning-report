import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { CleaningReport, Property, ReportItem } from '@/lib/types'

// 日本語フォント（Noto Sans JP CDN）
Font.register({
  family: 'NotoSansJP',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEi75vY0rw-oME.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFDEj75vY0rw-oME.ttf',
      fontWeight: 700,
    },
  ],
})

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 10,
    padding: 30,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  headerTable: {
    border: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 16,
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  headerLabel: {
    color: '#6b7280',
    width: 60,
  },
  headerValue: {
    fontWeight: 700,
    flex: 1,
    color: '#111827',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 12,
  },
  itemBlock: {
    marginBottom: 14,
    border: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 10,
    break: 'avoid',
  },
  itemTitle: {
    fontWeight: 700,
    fontSize: 11,
    color: '#1f2937',
    marginBottom: 8,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoCol: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 4,
  },
  beforeLabel: {
    color: '#2563eb',
  },
  afterLabel: {
    color: '#16a34a',
  },
  photo: {
    width: '100%',
    height: 140,
    objectFit: 'cover',
    borderRadius: 3,
    border: 1,
    borderColor: '#e5e7eb',
  },
  noPhoto: {
    width: '100%',
    height: 140,
    backgroundColor: '#f9fafb',
    borderRadius: 3,
    border: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoText: {
    color: '#9ca3af',
    fontSize: 9,
  },
  itemNotes: {
    marginTop: 6,
    fontSize: 9,
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    padding: 5,
    borderRadius: 3,
  },
  notesBlock: {
    marginTop: 8,
    border: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 10,
  },
  notesLabel: {
    fontWeight: 700,
    color: '#374151',
    marginBottom: 5,
    fontSize: 10,
  },
  notesText: {
    color: '#4b5563',
    fontSize: 9,
    lineHeight: 1.6,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  },
})

type Props = {
  report: CleaningReport & { properties: Property; report_items: ReportItem[] }
}

export default function CleaningReportPDF({ report }: Props) {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>清掃報告書</Text>

        {/* 基本情報 */}
        <View style={styles.headerTable}>
          <View style={styles.headerRow}>
            <Text style={styles.headerLabel}>物件名</Text>
            <Text style={styles.headerValue}>{report.properties?.name}</Text>
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.headerLabel}>住　所</Text>
            <Text style={styles.headerValue}>{report.properties?.address}</Text>
          </View>
          <View style={[styles.headerRow, { marginBottom: 0 }]}>
            <Text style={styles.headerLabel}>清掃日</Text>
            <Text style={styles.headerValue}>{formatDate(report.cleaned_at)}</Text>
          </View>
        </View>

        {/* 各項目 */}
        {report.report_items.map((item, i) => (
          <View key={item.id} style={styles.itemBlock} wrap={false}>
            <Text style={styles.itemTitle}>{i + 1}. {item.item_name}</Text>
            <View style={styles.photoRow}>
              <View style={styles.photoCol}>
                <Text style={[styles.photoLabel, styles.beforeLabel]}>BEFORE</Text>
                {item.before_photo_url ? (
                  <Image src={item.before_photo_url} style={styles.photo} />
                ) : (
                  <View style={styles.noPhoto}>
                    <Text style={styles.noPhotoText}>写真なし</Text>
                  </View>
                )}
              </View>
              <View style={styles.photoCol}>
                <Text style={[styles.photoLabel, styles.afterLabel]}>AFTER</Text>
                {item.after_photo_url ? (
                  <Image src={item.after_photo_url} style={styles.photo} />
                ) : (
                  <View style={styles.noPhoto}>
                    <Text style={styles.noPhotoText}>写真なし</Text>
                  </View>
                )}
              </View>
            </View>
            {item.item_notes && (
              <Text style={styles.itemNotes}>{item.item_notes}</Text>
            )}
          </View>
        ))}

        {/* 備考 */}
        {report.notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.notesLabel}>備考</Text>
            <Text style={styles.notesText}>{report.notes}</Text>
          </View>
        )}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        } fixed />
      </Page>
    </Document>
  )
}
