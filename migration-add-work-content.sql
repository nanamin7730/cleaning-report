-- 清掃報告書テーブルに「作業内容」列を追加
-- Supabase の SQL Editor で実行してください

ALTER TABLE cleaning_reports
ADD COLUMN IF NOT EXISTS work_content TEXT DEFAULT '掃き拭き掃除';
