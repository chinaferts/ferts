import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fontkit = require('fontkit');
import { PDFDocument, rgb, StandardFonts } from '@pdfme/pdf-lib';
import { isSupabaseConfigured, getSupabaseClient, requireSupabaseClient } from '../storage/supabase.js';

// ES Module 中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  mockGetInspections,
  mockGetInspection,
  mockCreateInspection,
  mockUpdateInspection,
  mockGetInspectionRecords,
  mockCreateInspectionRecord,
  mockGetDefects,
  mockCreateDefect,
  mockDeleteDefect,
  mockGetDashboardStats,
  UNIVERSAL_CHECKLIST_ITEMS
} from '../storage/mockData.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// 确保上传目录存在
const uploadsDir = path.join(process.cwd(), 'uploads', 'photos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 接收Base64照片并保存到服务器
router.post('/import-photo', async (req: Request, res: Response) => {
  try {
    const { photoData, recordId, oldPhotoPath } = req.body;
    
    if (!photoData) {
      return res.status(400).json({ success: false, error: '缺少照片数据' });
    }
    
    // 解析Base64数据
    const base64Data = photoData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 检测图片类型
    let extension = '.jpg';
    if (photoData.startsWith('data:image/png')) {
      extension = '.png';
    } else if (photoData.startsWith('data:image/webp')) {
      extension = '.webp';
    }
    
    // 生成唯一文件名
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${extension}`;
    const filePath = path.join(uploadsDir, filename);
    
    // 保存文件
    fs.writeFileSync(filePath, buffer);
    
    // 返回服务器路径（相对于uploads目录）
    const serverPath = `/uploads/photos/${filename}`;
    
    // 如果提供了recordId和旧照片路径，更新数据库
    if (recordId && isSupabaseConfigured()) {
      try {
        const client = requireSupabaseClient();
        
        // 获取当前照片列表
        const { data: record } = await client
          .from('inspection_records')
          .select('photos')
          .eq('id', recordId)
          .single();
        
        if (record) {
          let photos = [];
          try {
            photos = JSON.parse(record.photos || '[]');
          } catch (e) {
            photos = [];
          }
          
          // 如果有旧照片路径，替换它
          if (oldPhotoPath && photos.includes(oldPhotoPath)) {
            const index = photos.indexOf(oldPhotoPath);
            photos[index] = serverPath;
          } else if (!photos.includes(serverPath)) {
            photos.push(serverPath);
          }
          
          // 更新数据库
          await client
            .from('inspection_records')
            .update({ photos: JSON.stringify(photos) })
            .eq('id', recordId);
        }
      } catch (dbError) {
        console.error('更新照片路径失败:', dbError);
        // 即使数据库更新失败，文件已保存
      }
    }
    
    res.json({ success: true, serverPath });
  } catch (error) {
    console.error('导入照片失败:', error);
    res.status(500).json({ success: false, error: '导入照片失败' });
  }
});

// 获取验货列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, checklist_id } = req.query;

    if (!isSupabaseConfigured()) {
      const filters: any = {};
      // status为'all'时不过滤
      if (status && status !== 'all') filters.status = status as string;
      if (checklist_id) filters.checklist_id = checklist_id as string;
      return res.json({ success: true, data: mockGetInspections(filters) });
    }

    const client = requireSupabaseClient();
    
    // 如果 Supabase 未配置或查询失败，使用 mock 数据
    if (!client) {
      const filters: any = {};
      if (status && status !== 'all') filters.status = status as string;
      if (checklist_id) filters.checklist_id = checklist_id as string;
      return res.json({ success: true, data: mockGetInspections(filters) });
    }
    
    let query = client!.from('inspections').select('*').order('created_at', { ascending: false });

    // status为'all'时返回全部数据
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (checklist_id) {
      query = query.eq('checklist_id', checklist_id);
    }

    const { data, error } = await query;

    // 获取通用模板的 mock 数据（checklist_id=0）
    const mockUniversalData = mockGetInspections({ checklist_id: '0' });
    
    // 如果查询失败或返回空，使用 mock 数据兜底
    if (error || !data || data.length === 0) {
      const filters: any = {};
      if (status && status !== 'all') filters.status = status as string;
      if (checklist_id) filters.checklist_id = checklist_id as string;
      const mockData = mockGetInspections(filters);
      return res.json({ success: true, data: mockData });
    }
    
    // 获取所有验货的照片信息
    const inspectionIds = data.map((item: any) => item.id);
    const { data: recordsData } = await client!
      .from('inspection_records')
      .select('inspection_id, photos')
      .in('inspection_id', inspectionIds);
    
    // 整理照片信息
    const photosMap: { [key: number]: string[] } = {};
    if (recordsData) {
      for (const record of recordsData) {
        if (record.photos && Array.isArray(record.photos)) {
          if (!photosMap[record.inspection_id]) {
            photosMap[record.inspection_id] = [];
          }
          photosMap[record.inspection_id].push(...record.photos);
        }
      }
    }
    
    // 将照片信息添加到验货数据中
    const dataWithPhotos = data.map((item: any) => ({
      ...item,
      photos: photosMap[item.id] || []
    }));
    
    // 合并 Supabase 数据和通用模板 mock 数据，避免重复
    const supabaseIds = new Set(dataWithPhotos.map((item: any) => item.id));
    const mergedData = [
      ...dataWithPhotos,
      ...mockUniversalData.filter((item: any) => !supabaseIds.has(item.id))
    ];
    
    res.json({ success: true, data: mergedData });
  } catch (err: any) {
    // 发生错误时使用 mock 数据兜底
    console.error('获取验货列表失败:', err);
    const filters: any = {};
    const { status, checklist_id } = req.query;
    if (status && status !== 'all') filters.status = status as string;
    if (checklist_id) filters.checklist_id = checklist_id as string;
    const mockData = mockGetInspections(filters);
    return res.json({ success: true, data: mockData });
  }
});

// 获取仪表盘统计数据
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.json({ success: true, data: mockGetDashboardStats() });
    }

    const client = requireSupabaseClient();
    
    const [totalResult, completedResult, inProgressResult, pendingResult] = await Promise.all([
      client!.from('inspections').select('id', { count: 'exact' }),
      client!.from('inspections').select('id', { count: 'exact' }).eq('status', 'completed'),
      client!.from('inspections').select('id', { count: 'exact' }).eq('status', 'in_progress'),
      client!.from('inspections').select('id', { count: 'exact' }).eq('status', 'pending')
    ]);

    const total = totalResult.count || 0;
    const completed = completedResult.count || 0;
    const inProgress = inProgressResult.count || 0;
    const pending = pendingResult.count || 0;

    const passRateResult = await client!
      .from('inspections')
      .select('failed_items')
      .eq('status', 'completed');

    let passRate = 0;
    if (passRateResult.data && passRateResult.data.length > 0) {
      const passedCount = passRateResult.data.filter((i: any) => i.failed_items === 0).length;
      passRate = Math.round((passedCount / passRateResult.data.length) * 100);
    }

    const { data: recentInspections } = await client
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentDefects } = await client
      .from('defects')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      success: true,
      data: {
        total,
        completed,
        inProgress,
        pending,
        passRate,
        recentInspections: recentInspections || [],
        recentDefects: recentDefects || []
      }
    });
  } catch (err: any) {
    console.error('获取统计数据失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取单个验货详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!isSupabaseConfigured()) {
      const inspection = mockGetInspection(id);
      if (!inspection) {
        return res.status(404).json({ success: false, error: '验货记录不存在' });
      }
      return res.json({ success: true, data: inspection });
    }

    const client = requireSupabaseClient();

    // 获取验货记录Basic Information
    const { data: inspection, error } = await client
      .from('inspections')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !inspection) {
      // 如果 Supabase 查询失败或没有数据，尝试使用 mock 数据
      const mockInspection = mockGetInspection(id);
      if (!mockInspection) {
        return res.status(404).json({ success: false, error: '验货记录不存在' });
      }
      return res.json({ success: true, data: mockInspection });
    }

    // 获取检查记录及其关联的清单项
    const { data: records } = await client
      .from('inspection_records')
      .select('*, checklist_items(*)')
      .eq('inspection_id', id)
      .order('created_at', { ascending: true });

    // 如果是嵌入式模板(checklist_id=11 且没有记录，或 checklist_id=0)
    // 使用 UNIVERSAL_CHECKLIST_ITEMS
    const isEmbeddedTemplate = inspection.checklist_id === 0 || 
                                String(inspection.checklist_id) === '0' ||
                                (inspection.checklist_id === 11 && (!records || records.length === 0));
    if (isEmbeddedTemplate || !records || records.length === 0) {
      // 先在数据库中创建 inspection_records 记录，确保后续更新操作正常
      const universalItems = UNIVERSAL_CHECKLIST_ITEMS.map(async (item, index) => {
        // 使用 item.name 作为唯一标识（因为数据库 item_id 是 integer 类型，不能存储 'u1' 这样的字符串）
        const itemName = item.name;
        
        // 检查是否已存在对应的清单项
        const { data: existingItem } = await client
          .from('checklist_items')
          .select('id')
          .eq('checklist_id', 11)
          .eq('name', item.name)
          .single();
        
        let realChecklistItemId: number | null = null;
        
        if (existingItem) {
          realChecklistItemId = existingItem.id;
        } else {
          // 创建新的清单项（注意：checklist_items 表没有 category 字段，is_required 是 NOT NULL）
          const { data: newItem, error: insertError } = await client
            .from('checklist_items')
            .insert({
              checklist_id: 11,
              name: item.name,
              description: item.description,
              item_type: 'standard',
              item_order: index,
              is_required: item.is_required || false
            })
            .select()
            .single();
          realChecklistItemId = newItem?.id;
        }
        
        if (!realChecklistItemId) {
          // 如果无法获取有效的 ID，跳过此记录
          return null;
        }
        
        // 检查是否已存在检查记录（通过 item_name 匹配）
        const { data: existingRecord } = await client
          .from('inspection_records')
          .select('id, photos, barcode_codes')
          .eq('inspection_id', id)
          .eq('item_name', itemName)
          .single();
        
        if (!existingRecord) {
          // 创建新的检查记录（使用 checklist_item_id 作为 item_id，因为 item_id 是 integer）
          const { data: newRecord } = await client
            .from('inspection_records')
            .insert({
              inspection_id: id,
              item_id: realChecklistItemId,  // 使用数据库 ID 作为 item_id（integer）
              checklist_item_id: realChecklistItemId,
              item_name: item.name,
              item_description: item.description,
              item_category: item.category,
              result: 'unchecked'
            })
            .select()
            .single();
          return {
            id: item.name,  // 使用 item_name 作为 id
            record_id: newRecord?.id || 0,
            checklist_item_id: realChecklistItemId,
            name: item.name,
            description: item.description,
            category: item.category,
            result: 'unchecked',
            photos: [],
            barcodeCodes: [],
            barcode_codes: []
          };
        }
        
        return {
          id: itemName,  // 使用 item_name 作为 id
          record_id: existingRecord.id,
          checklist_item_id: realChecklistItemId,
          name: item.name,
          description: item.description,
          category: item.category,
          result: 'unchecked',
          photos: existingRecord.photos || [],
          barcodeCodes: existingRecord.barcode_codes || [],
          barcode_codes: existingRecord.barcode_codes || []
        };
      });
      
      // 等待所有异步操作完成，并过滤掉 null 值
      const resolvedItems = (await Promise.all(universalItems)).filter(Boolean);
      
      return res.json({
        success: true,
        data: {
          ...inspection,
          checklist_items: resolvedItems,
          categories: [...new Set(resolvedItems.map((item: any) => item.category))],
          defects: [],
          photos: [],
          checkedCount: 0,
          defectCount: 0
        }
      });
    }

    // 获取Defect Records
    const { data: defects } = await client
      .from('defects')
      .select('*')
      .eq('inspection_id', id);

    // 获取检查照片
    const { data: photos } = await client
      .from('inspection_photos')
      .select('*')
      .eq('inspection_id', id);

    // 组合数据
    const checklist_items = (records || []).map((record: any) => {
      const item = record.checklist_items;
      // 从 inspection_photos 表获取该记录的照片
      const recordPhotos = photos?.filter((p: any) => p.record_id === record.id).map((p: any) => p.photo_url) || [];
      const recordBarcodes = record.barcode_codes || [];
      
      // 合并两个来源的照片：inspection_records.photos 字段 + inspection_photos 表
      // 保留所有有效的图片路径（包括服务器路径和本地路径）
      // 注意：本地路径（file:///...）只能在拍摄设备上访问，其他设备会显示空白
      // 同时过滤掉非图片文件（如 .txt 测试文件）
      const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      const isValidImage = (p: string) => {
        const lower = p.toLowerCase();
        return validImageExtensions.some(ext => lower.endsWith(ext));
      };
      const photosFromRecord = (record.photos || []).filter((p: string) => 
        (p.startsWith('/uploads/') || p.startsWith('http://') || p.startsWith('https://') || p.startsWith('file://') || p.startsWith('content://')) && isValidImage(p)
      );
      const photosFromTable = recordPhotos.filter((p: string) => isValidImage(p));
      // 合并去重
      const allPhotos = [...new Set([...photosFromRecord, ...photosFromTable])];
      
      console.log('[GET_INSPECTION] Record:', {
        id: record.id,
        item_name: record.item_name,
        record_photos_field: photosFromRecord,
        table_photos: photosFromTable,
        merged_photos: allPhotos
      });
      
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        category: record.item_category || item.name || item.item_type || 'general',
        status: record.result || 'unchecked',
        notes: record.notes,
        score: record.score,
        record_id: record.id,
        photos: allPhotos,
        barcodeCodes: recordBarcodes
      };
    });

    // 按分类分组
    const categories = [...new Set(checklist_items.map((item: any) => item.category))];

    const result = {
      ...inspection,
      // 字段映射：数据库字段名 -> 前端期望的字段名
      inspector: inspection.inspector_name || inspection.inspector,
      inspection_date: inspection.scheduled_date || inspection.inspection_date,
      // 新增字段映射
      orderNo: inspection.order_number,
      productNo: inspection.style_number || inspection.product_sku,
      quantity: inspection.quantity,
      sampleSize: inspection.sample_size,
      aql: inspection.aql,
      checklist_items,
      categories,
      defects: defects || [],
      photos: photos || [],
      checkedCount: records?.filter((r: any) => r.result !== 'unchecked').length || 0,
      defectCount: defects?.length || 0
    };

    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('获取验货详情失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 创建验货记录
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      orderNo, 
      productNo, 
      supplier, 
      product, 
      quantity,
      aql, 
      sampleSize, 
      templateId,
      checklist_id, 
      supplier_name, 
      product_name, 
      batch_number, 
      inspection_date, 
      inspector, 
      notes 
    } = req.body;

    // 处理 templateId=0 的情况（嵌入式通用模板），不使用数据库模板
    // checklist_id=0 表示使用完全嵌入式的 UNIVERSAL_CHECKLIST_ITEMS
    const isEmbeddedTemplate = templateId === 0 || templateId === '0';
    const effectiveChecklistId = isEmbeddedTemplate ? 0 : (templateId || checklist_id);

    // 如果 Supabase 未配置，使用 mock 模式
    if (!isSupabaseConfigured()) {
      const newInspection = mockCreateInspection({
        checklist_id: isEmbeddedTemplate ? 0 : effectiveChecklistId,
        supplier_name: supplier || supplier_name,
        product_name: product || product_name,
        batch_number: orderNo || batch_number,
        inspection_date,
        inspector,
        notes,
        order_no: orderNo,
        product_no: productNo,
        quantity: quantity || null,
        aql,
        sample_size: sampleSize
      });
      return res.json({ success: true, data: newInspection });
    }

    // Supabase 已配置，使用数据库存储
    const client = requireSupabaseClient();

    // 嵌入式模板使用 checklist_id=11（数据库中已存在的模板ID），但不复制其清单项
    // 获取详情时会使用嵌入式 UNIVERSAL_CHECKLIST_ITEMS
    const { data: inspection, error: inspectionError } = await client
      .from('inspections')
      .insert({
        checklist_id: isEmbeddedTemplate ? 11 : effectiveChecklistId,
        supplier_name: supplier || supplier_name,
        product_name: product || product_name,
        product_sku: productNo || null,
        // 如果订单号为空，自动生成
        order_number: orderNo || `AUTO-${Date.now()}`,
        quantity: quantity || null,
        sample_size: sampleSize || null,
        aql: aql ? parseFloat(aql) : null,
        style_number: productNo || null,
        status: 'pending',
        inspector_name: inspector,
        notes,
        scheduled_date: inspection_date
      })
      .select()
      .single();

    if (inspectionError) throw inspectionError;

    // 3. 复制清单项（包括嵌入式模板，使用数据库 checklist_id=11）
    if (effectiveChecklistId !== undefined && effectiveChecklistId !== null) {
      // 嵌入式模板使用 checklist_id=11
      const sourceChecklistId = isEmbeddedTemplate ? 11 : effectiveChecklistId;
      console.log('Copying checklist items for checklist_id:', sourceChecklistId, 'isEmbedded:', isEmbeddedTemplate);
      
      const { data: templateItems, error: itemsError } = await client
        .from('checklist_items')
        .select('*')
        .eq('checklist_id', sourceChecklistId)
        .order('item_order', { ascending: true });

      console.log('Found checklist items:', templateItems?.length || 0, 'items error:', itemsError);

      if (!itemsError && templateItems && templateItems.length > 0) {
        const records = templateItems.map((item: any) => ({
          inspection_id: inspection.id,
          item_id: item.id,
          checklist_item_id: item.id,
          item_name: item.name,
          item_description: item.description,
          item_category: item.category,
          result: 'unchecked',
          score: null,
          notes: null
        }));

        const { error: recordsError } = await client
          .from('inspection_records')
          .insert(records);

        console.log('Inserted inspection records, error:', recordsError);
      }
    }

    res.json({ success: true, data: inspection });
  } catch (err: any) {
    console.error('创建验货记录失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 更新验货记录
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updateData = req.body;

    if (!isSupabaseConfigured()) {
      const updated = mockUpdateInspection(id, updateData);
      if (!updated) {
        return res.status(404).json({ success: false, error: '验货记录不存在' });
      }
      return res.json({ success: true, data: updated });
    }

    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('inspections')
      .update(updateData)
      .eq('id', id)
      .select();

    // 如果 select() 返回多条记录，取第一条
    const updatedInspectionData = Array.isArray(data) ? data[0] : data;

    if (error) throw error;
    res.json({ success: true, data: updatedInspectionData });
  } catch (err: any) {
    console.error('更新验货记录失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 提交验货记录（完成验货）
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { notes, result } = req.body;

    if (!isSupabaseConfigured()) {
      const records = mockGetInspectionRecords(id);
      const defects = mockGetDefects(id);
      
      const passedItems = records.filter((r: any) => r.result === 'passed').length;
      const failedItems = defects.length;
      
      // 根据结果计算通过数
      let passedItemsFinal = passedItems;
      if (result === 'pass') {
        // Pass提交：Pending的项目也算通过
        passedItemsFinal = records.length;
      } else if (result === 'fail') {
        // 不Pass提交：保持原来的通过数
        passedItemsFinal = passedItems;
      }
      
      const updated = mockUpdateInspection(id, {
        status: 'completed',
        result: result,
        total_items: records.length,
        passed_items: passedItemsFinal,
        failed_items: failedItems,
        notes
      });
      
      if (!updated) {
        return res.status(404).json({ success: false, error: '验货记录不存在' });
      }
      return res.json({ success: true, data: updated });
    }

    const client = requireSupabaseClient();
    
    // 构建更新对象
    const updateData: any = {
      status: 'completed',
      overall_result: result,
      notes
    };

    const { data, error } = await client
      .from('inspections')
      .update(updateData)
      .eq('id', id)
      .select();

    // 如果 select() 返回多条记录（没有 .single()），取第一条
    const updatedInspection = Array.isArray(data) ? data[0] : data;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('提交验货记录失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 添加验货记录项
router.post('/:id/records', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { checklist_item_id, item_name, result, notes } = req.body;

    if (!isSupabaseConfigured()) {
      const newRecord = mockCreateInspectionRecord({
        inspection_id: id,
        checklist_item_id,
        item_name,
        result,
        notes
      });
      return res.json({ success: true, data: newRecord });
    }

    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('inspection_records')
      .insert({
        inspection_id: id,
        checklist_item_id,
        item_name,
        result,
        notes
      })
      .select();

    // 如果 select() 返回多条记录，取第一条
    const insertedRecord = Array.isArray(data) ? data[0] : data;

    if (error) throw error;

    // 更新验货状态为In Progress
    await client
      .from('inspections')
      .update({ status: 'in_progress' })
      .eq('id', id)
      .eq('status', 'pending');

    res.json({ success: true, data: insertedRecord });
  } catch (err: any) {
    console.error('添加验货记录项失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取验货记录项列表
router.get('/:id/records', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!isSupabaseConfigured()) {
      return res.json({ success: true, data: mockGetInspectionRecords(id) });
    }

    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('inspection_records')
      .select('*')
      .eq('inspection_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('获取验货记录项列表失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 更新检查记录结果
router.put('/:id/records/:recordId', async (req: Request, res: Response) => {
  try {
    const { id, recordId } = req.params;
    const { result, notes, photos, barcode_codes } = req.body;
    
    console.log('[PUT_RECORDS] Received request:', {
      id,
      recordId,
      result,
      photosCount: photos?.length,
      barcode_codesCount: barcode_codes?.length,
      barcode_codes: barcode_codes
    });

    if (!isSupabaseConfigured()) {
      console.log('[PUT_RECORDS] Mock mode - returning success');
      return res.json({ success: true, data: { id: recordId, result, notes, photos, barcode_codes } });
    }

    const client = requireSupabaseClient();
    
    // 确保 recordId 是字符串类型
    const recordIdStr = Array.isArray(recordId) ? recordId[0] : recordId;
    
    // 检查 recordId 是否是有效的数字 ID（大于0的整数）
    const parsedId = parseInt(recordIdStr);
    const isValidNumericId = !isNaN(parsedId) && parsedId > 0;
    
    // 构建更新对象
    const updateData: any = {
      result: result,
      notes: notes || null,
      updated_at: new Date().toISOString()
    };
    
    // 如果提供了 photos 或 barcode_codes，也更新它们
    if (photos !== undefined) {
      updateData.photos = photos;
      console.log('[PUT_RECORDS] Updating photos:', photos);
    }
    if (barcode_codes !== undefined) {
      updateData.barcode_codes = barcode_codes;
      console.log('[PUT_RECORDS] Updating barcode_codes:', barcode_codes);
    }
    
    let query = client
      .from('inspection_records')
      .update(updateData)
      .eq('inspection_id', id);
    
    // 根据 recordId 类型选择查询条件
    if (isValidNumericId) {
      // 使用数据库 ID 更新
      query = query.eq('id', parsedId);
    } else {
      // 如果不是有效的数字 ID（recordId=0 或 recordId 是 item.name），尝试使用 item_name 匹配
      // 支持前端传递 item.name 来更新嵌入式模板的检查项
      query = query.eq('item_name', recordId);
    }
    
    const { data, error } = await query.select();

    // 如果 select() 返回多条记录，取第一条
    const updatedRecord = Array.isArray(data) ? data[0] : data;
    
    console.log('[PUT_RECORDS] Update result:', { data: updatedRecord, error });

    if (error) throw error;

    // 更新验货状态为In Progress
    await client
      .from('inspections')
      .update({ status: 'in_progress' })
      .eq('id', id)
      .eq('status', 'pending');

    res.json({ success: true, data: updatedRecord });
  } catch (err: any) {
    console.error('更新检查记录失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 创建新的检查项
router.post('/:id/checklist-items', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // 接受前端发送的参数名称
    const { name, category, result, photos, barcode_codes, barcode_type } = req.body;

    if (!isSupabaseConfigured()) {
      const mockId = Math.floor(Math.random() * 1000000);
      return res.json({ success: true, data: { id: mockId, name, category } });
    }

    const client = requireSupabaseClient();
    
    // 先在 checklist_items 中创建记录
    const { data: newChecklistItem, error: checklistError } = await client
      .from('checklist_items')
      .insert({
        checklist_id: 11, // 使用通用模板ID
        name: name || '条码扫描',
        item_type: barcode_type || 'barcode',
        is_required: false,
        item_order: 999
      })
      .select()
      .single();

    if (checklistError) {
      console.error('Failed to create checklist_item:', checklistError);
      return res.status(500).json({ success: false, error: 'Failed to create checklist item' });
    }
    
    // 确保 id 是字符串类型
    const idStr = Array.isArray(id) ? id[0] : id;
    
    // 再在 inspection_records 中创建记录
    const { data: recordData, error: recordError } = await client
      .from('inspection_records')
      .insert({
        inspection_id: parseInt(idStr),
        item_id: newChecklistItem.id,  // 兼容旧字段
        checklist_item_id: newChecklistItem.id,
        result: result,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (recordError) {
      console.error('Failed to create inspection_record:', recordError);
      return res.status(500).json({ success: false, error: 'Failed to create inspection record' });
    }

    // 返回 inspection_records 的 id
    const record = recordData[0];
    res.json({ success: true, data: { id: record.id, checklist_item_id: newChecklistItem.id } });
  } catch (err: any) {
    console.error('创建检查项失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 更新检查项条码
router.patch('/:id/checklist-items/:itemId', async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const { barcodeCodes, codes, photos } = req.body;

    if (!isSupabaseConfigured()) {
      return res.json({ success: true, data: { id: itemId, barcodeCodes, codes, photos } });
    }

    const client = requireSupabaseClient();
    
    // 更新 inspection_records 表中的 barcode_codes 和 photos 字段
    const recordUpdateData: any = {};
    if (barcodeCodes !== undefined) recordUpdateData.barcode_codes = barcodeCodes;
    if (codes !== undefined) recordUpdateData.barcode_codes = codes;
    if (photos !== undefined) recordUpdateData.photos = photos;

    // 查找对应的 inspection_record（itemId 在这里是 record_id）
    // 对于嵌入式模板，recordId 可能是 item.name 而不是数字 ID
    const itemIdStr = Array.isArray(itemId) ? itemId[0] : itemId;
    const isValidNumericId = itemIdStr && !isNaN(parseInt(itemIdStr)) && parseInt(itemIdStr) > 0;
    
    let query = client
      .from('inspection_records')
      .update({
        ...recordUpdateData,
        updated_at: new Date().toISOString()
      })
      .eq('inspection_id', id);
    
    if (isValidNumericId) {
      query = query.eq('id', parseInt(itemIdStr));
    } else {
      // 如果不是有效的数字 ID，使用 item_name 匹配（嵌入式模板）
      query = query.eq('item_name', itemId);
    }
    
    const { data: recordData, error: recordError } = await query.select();

    const updatedRecord = Array.isArray(recordData) ? recordData[0] : recordData;

    if (recordError && recordError.code !== 'PGRST116') {
      console.error('更新检查项条码失败:', recordError);
      return res.status(500).json({ success: false, error: 'Failed to update barcode codes' });
    }

    // 更新验货状态为In Progress
    await client
      .from('inspections')
      .update({ status: 'in_progress' })
      .eq('id', id)
      .eq('status', 'pending');

    res.json({ success: true, data: updatedRecord });
  } catch (err: any) {
    console.error('更新检查项失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 上传检查照片
router.post('/:id/photos', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { inspection_id, defect_id, category, record_id, item_name } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: '请上传图片文件' });
    }

    if (!isSupabaseConfigured()) {
      // Mock模式下返回模拟URL
      const mockUrl = `https://mock-storage.example.com/photos/${Date.now()}-${file.originalname}`;
      return res.json({
        success: true,
        data: {
          id: String(Date.now()),
          inspection_id: id,
          record_id,
          photo_url: mockUrl,
          photo_type: 'checklist'
        }
      });
    }

    // 保存照片到本地文件系统
    const uploadDir = path.join(process.cwd(), 'uploads', 'photos');
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(uploadDir, fileName);
    
    // 确保目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // 保存文件
    fs.writeFileSync(filePath, file.buffer);
    console.log('[UPLOAD_PHOTO] 文件已保存到:', filePath);
    
    // 生成访问URL（相对于 uploads 目录）
    const photoUrl = `/uploads/photos/${fileName}`;
    
    // 如果 Supabase 配置了，保存到数据库；否则只返回本地URL
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('inspection_photos')
      .insert({
        inspection_id: parseInt(id as string),
        photo_url: photoUrl,
        photo_type: 'checklist',
        record_id: record_id ? parseInt(record_id) : null
      })
      .select();

    // 如果 select() 返回多条记录，取第一条
    const insertedPhoto = Array.isArray(data) ? data[0] : data;

    if (error) throw error;
    res.json({ success: true, data: insertedPhoto });
  } catch (err: any) {
    console.error('上传照片失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 生成Inspection Report PDF (使用 @pdfme/pdf-lib)
router.get('/:id/export-pdf', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = requireSupabaseClient();
    const idStr = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const inspectionId = parseInt(idStr || '0');

    let inspection: any;
    
    // 尝试使用 mock 数据（mockGetInspection 返回完整的验货数据）
    const mockInspection = mockGetInspection(idStr);
    if (mockInspection) {
      inspection = mockInspection;
    } else {
      const { data, error } = await client
        .from('inspections').select('*').eq('id', inspectionId).single();
      if (error || !data) {
        res.status(404).json({ success: false, error: 'Inspection not found' });
        return;
      }
      inspection = data;
      
      // 从数据库获取 inspection_records
      const { data: recordsData } = await client
        .from('inspection_records')
        .select('*')
        .eq('inspection_id', inspectionId);
      inspection.inspection_records = recordsData || [];
      
      // 从数据库获取 defects
      const { data: defectsData } = await client
        .from('defects')
        .select('*')
        .eq('inspection_id', inspectionId);
      inspection.defects = defectsData || [];
    }

    // 获取照片记录
    const { data: photos } = await client
      .from('inspection_photos')
      .select('*')
      .eq('inspection_id', inspectionId);
    
    // 按 record_id 分组照片
    const photosByRecordId = new Map<number, string[]>();
    if (photos) {
      for (const photo of photos) {
        if (photo.record_id) {
          if (!photosByRecordId.has(photo.record_id)) {
            photosByRecordId.set(photo.record_id, []);
          }
          photosByRecordId.get(photo.record_id)!.push(photo.photo_url);
        }
      }
    }
    const defects = inspection.defects || [];
    console.log('[EXPORT_PDF] Photos by record_id:', Array.from(photosByRecordId.entries()).slice(0, 3));

    const records = inspection.records || inspection.inspection_records || [];

    console.log('[EXPORT_PDF] Inspection:', { id: inspection.id, hasRecords: !!inspection.records, hasInspectionRecords: !!inspection.inspection_records, recordsCount: records.length });

    // 构建分类和检查项（从 records 转换）
    const checklistItems = records.map((record: any) => ({
      id: record.checklist_item_id || record.id,
      name: record.item_name,
      description: record.item_description,
      category: record.item_category,
      status: record.result,
      notes: record.notes,
      record_id: record.id,
      photos: record.photos || [],
      barcodeCodes: record.barcode_codes || []
    }));
    
    const categoriesMap = new Map<string, any[]>();
    for (const item of checklistItems) {
      const category = item.category || 'General';
      if (!categoriesMap.has(category)) categoriesMap.set(category, []);
      categoriesMap.get(category)!.push(item);
    }
    const recordsMap = new Map<number, any>();
    for (const record of records) recordsMap.set(record.checklist_item_id, record);
    console.log('[EXPORT_PDF] Records map:', Array.from(recordsMap.entries()).slice(0, 3));

    let passCount = 0, failCount = 0, naCount = 0, pendingCount = 0;
    for (const item of checklistItems) {
      const record = recordsMap.get(item.id);
      if (record) {
        if (record.result === 'pass') passCount++;
        else if (record.result === 'fail') failCount++;
        else if (record.result === 'na') naCount++;
        else pendingCount++;
      } else pendingCount++;
    }

    // 使用 @pdfme/pdf-lib 直接生成 PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    
    // 加载 NotoSans 字体支持中文
    const fontPath = path.join(__dirname, '..', 'fonts', 'NotoSans-Regular.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    const notoFont = await pdfDoc.embedFont(fontBytes);
    
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 50;
    let y = pageHeight - margin;

    const addPage = () => {
      pdfDoc.addPage([pageWidth, pageHeight]);
      return { y: pageHeight - margin };
    };

    const drawText = async (text: string, x: number, currentY: number, font: any, size: number, options: { bold?: boolean; color?: string } = {}) => {
      let currentYPos = currentY;
      
      // Simple text wrapping
      const maxWidth = pageWidth - margin * 2;
      const words = text.split(' ');
      let line = '';
      const lines: string[] = [];
      
      for (const word of words) {
        const testLine = line ? line + ' ' + word : word;
        const width = font.widthOfTextAtSize(testLine, size);
        if (width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) lines.push(line);
      
      for (const l of lines) {
        if (currentYPos < margin + 20) {
          const newPage = addPage();
          currentYPos = newPage.y;
        }
        const hexColor = options.color === 'green' ? '00AA00' : options.color === 'red' ? 'CC0000' : options.color === 'gray' ? '666666' : options.color === 'orange' ? 'FF8800' : '000000';
        const page = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
        page.drawText(l, { x, y: currentYPos, size, font, color: rgb(parseInt(hexColor.slice(0,2), 16)/255, parseInt(hexColor.slice(2,4), 16)/255, parseInt(hexColor.slice(4), 16)/255) });
        currentYPos -= size + 4;
      }
      return currentYPos;
    };

    let { y: startY } = addPage();
    y = startY;

    // Title (中文)
    y = await drawText('验货报告', pageWidth / 2 - notoFont.widthOfTextAtSize('验货报告', 22) / 2, y, notoFont, 22);
    y -= 10;
    
    // Report number (中英混合)
    y = await drawText('报告编号: ' + (inspection.inspection_number || 'N/A'), pageWidth / 2 - notoFont.widthOfTextAtSize('报告编号: ' + (inspection.inspection_number || 'N/A'), 12) / 2, y, notoFont, 12);
    y -= 25;

    // Basic Information Header
    y = await drawText('基本信息', margin, y, notoFont, 14);
    y -= 15;
    
    const infoItems = [
      ['产品名称', inspection.product_name || 'N/A'],
      ['供应商', inspection.supplier || 'N/A'],
      ['批次号', inspection.batch_number || 'N/A'],
      ['验货日期', inspection.inspection_date || 'N/A'],
      ['验货员', inspection.inspector_name || inspection.created_by || 'N/A'],
      ['状态', inspection.status === 'completed' ? '已完成' : '进行中']
    ];

    for (const [label, value] of infoItems) {
      y = await drawText(label + ': ' + value, margin + 10, y, notoFont, 10);
    }
    y -= 15;

    // Summary
    y = await drawText('汇总', margin, y, notoFont, 14);
    y -= 15;

    // Summary table header
    const summaryStartX = margin + 10;
    const colWidth = 100;
    const headers = ['通过', '不通过', '不适用', '待检'];
    const summaryValues = [passCount.toString(), failCount.toString(), naCount.toString(), pendingCount.toString()];
    const summaryColors = ['green', 'red', 'gray', 'orange'];
    
    for (let i = 0; i < 4; i++) {
      const xPos = summaryStartX + i * colWidth;
      y = await drawText(headers[i], xPos, y, notoFont, 10);
      y = await drawText(summaryValues[i], xPos, y, notoFont, 10, { color: summaryColors[i] });
    }
    y -= 15;

    // Checklist Items
    y = await drawText('检查项', margin, y, notoFont, 14);
    y -= 10;

    for (const [category, items] of categoriesMap) {
      if (y < margin + 50) {
        const newPage = addPage();
        y = newPage.y;
      }
      y = await drawText(category, margin + 5, y, notoFont, 11);
      y -= 5;
      
      for (const item of items) {
        const record = recordsMap.get(item.id);
        let statusText = '待检', statusColor = 'gray';
        if (record) {
          if (record.result === 'pass') { statusText = '通过'; statusColor = 'green'; }
          else if (record.result === 'fail') { statusText = '不通过'; statusColor = 'red'; }
          else if (record.result === 'na') { statusText = '不适用'; statusColor = 'gray'; }
        }
        const itemName = (item.item_number || '') + ' ' + (item.item_name || item.name || 'N/A');
        y = await drawText(itemName + ' - ' + statusText, margin + 15, y, notoFont, 9, { color: statusColor });
        
        // 添加照片 - 使用 inspection_photos 表中的照片
        const recordId = record?.id;
        const recordPhotos = recordId ? (photosByRecordId.get(recordId) || []) : [];
        if (recordPhotos.length > 0) {
          y -= 5;
          for (const photoUrl of recordPhotos.slice(0, 3)) { // 最多显示3张照片
            if (y < margin + 80) {
              const newPage = addPage();
              y = newPage.y;
            }
            try {
              // 读取本地照片文件
              const fullPhotoPath = path.join(process.cwd(), photoUrl);
              if (fs.existsSync(fullPhotoPath)) {
                const photoBytes = fs.readFileSync(fullPhotoPath);
                let img;
                if (photoUrl.toLowerCase().endsWith('.png')) {
                  img = await pdfDoc.embedPng(photoBytes);
                } else {
                  img = await pdfDoc.embedJpg(photoBytes);
                }
                const imgDims = img.scale(100 / Math.max(img.width, img.height));
                const page = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
                page.drawImage(img, { x: margin + 20, y: y - imgDims.height, width: imgDims.width, height: imgDims.height });
                y -= imgDims.height + 5;
              }
            } catch (photoErr) {
              console.log('Failed to embed photo:', photoUrl, photoErr);
            }
          }
        }
      }
      y -= 5;
    }

    // Defect Records
    if (defects && defects.length > 0) {
      if (y < margin + 100) {
        const newPage = addPage();
        y = newPage.y;
      }
      y -= 10;
      y = await drawText('缺陷记录', margin, y, notoFont, 14);
      y -= 5;
      
      for (const defect of defects) {
        const severityText = defect.severity === 'critical' ? '严重' : defect.severity === 'major' ? '主要' : '轻微';
        y = await drawText('- ' + (defect.description || 'N/A') + ' (' + severityText + ')', margin + 10, y, notoFont, 9);
      }
    }

    // Generated time
    y -= 15;
    const genText = '生成时间: ' + new Date().toLocaleString('zh-CN');
    y = await drawText(genText, pageWidth / 2 - notoFont.widthOfTextAtSize(genText, 8) / 2, y, notoFont, 8, { color: 'gray' });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    const filename = 'Inspection_Report_' + (inspection.inspection_number || 'unknown') + '.pdf';
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('PDF report generation failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
