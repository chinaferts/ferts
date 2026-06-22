-- 清理重复的条码扫描检查项模板
-- 问题：模板中有多个重复的"条码扫描以及拍照"检查项
-- 解决：只保留每模板中第一条条码扫描项

-- 清理模板11
DELETE FROM checklist_items 
WHERE checklist_id = 11 
  AND name = '条码扫描以及拍照' 
  AND id != (
    SELECT MIN(id) FROM checklist_items 
    WHERE checklist_id = 11 AND name = '条码扫描以及拍照'
  );

-- 清理现有验货记录中的重复条码项（只保留每验货第一条）
DELETE FROM inspection_records 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY inspection_id ORDER BY id) as rn
    FROM inspection_records 
    WHERE item_name = '条码扫描以及拍照' OR item_category = '条码扫描以及拍照'
  ) sub
  WHERE rn > 1
);
