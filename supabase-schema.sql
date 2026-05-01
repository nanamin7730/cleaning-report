-- =============================================
-- 清掃報告書アプリ Supabase データベーススキーマ
-- Supabase の SQL Editor に貼り付けて実行してください
-- =============================================

-- 物件テーブル
CREATE TABLE properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,           -- 物件名
  address TEXT NOT NULL,        -- 住所
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 撮影項目テーブル（物件ごとに設定）
CREATE TABLE inspection_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,           -- 項目名（例：玄関、トイレ、キッチン）
  sort_order INTEGER DEFAULT 0, -- 表示順
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 清掃報告書テーブル
CREATE TABLE cleaning_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  cleaned_at DATE NOT NULL,     -- 清掃日
  notes TEXT,                   -- 備考
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 報告書項目テーブル（ビフォーアフター写真）
CREATE TABLE report_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES cleaning_reports(id) ON DELETE CASCADE NOT NULL,
  inspection_item_id UUID REFERENCES inspection_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,      -- 項目名（スナップショット）
  before_photo_url TEXT,        -- ビフォー写真URL
  after_photo_url TEXT,         -- アフター写真URL
  item_notes TEXT,              -- 項目別備考
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS) 設定
-- =============================================

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_items ENABLE ROW LEVEL SECURITY;

-- ログインしているユーザー全員が全データを読み書きできる
-- （チームで共有する想定）
CREATE POLICY "authenticated_all" ON properties
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all" ON inspection_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all" ON cleaning_reports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all" ON report_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- Storage バケット（写真保存用）
-- =============================================

-- Supabase Dashboard > Storage > New Bucket で作成
-- バケット名: report-photos
-- Public: ON（写真URLを直接表示するため）

-- Storage ポリシー（SQL Editor で実行）
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-photos');

CREATE POLICY "public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'report-photos');

CREATE POLICY "authenticated delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'report-photos');
