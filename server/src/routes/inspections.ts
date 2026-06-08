import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { isSupabaseConfigured, getSupabaseClient, requireSupabaseClient } from '../storage/supabase.js';
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
    
    // 合并 Supabase 数据和通用模板 mock 数据，避免重复
    const supabaseIds = new Set(data.map((item: any) => item.id));
    const mergedData = [
      ...data,
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

    // 获取验货记录基本信息
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

    // 获取缺陷记录
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
      const photosFromRecord = record.photos || [];
      const photosFromTable = recordPhotos || [];
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
        // 合格提交：未检查的项目也算通过
        passedItemsFinal = records.length;
      } else if (result === 'fail') {
        // 不合格提交：保持原来的通过数
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

    // 更新验货状态为进行中
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
    
    // 检查 recordId 是否是有效的数字 ID（大于0的整数）
    const parsedId = parseInt(recordId);
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

    // 更新验货状态为进行中
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
    
    // 再在 inspection_records 中创建记录
    const { data: recordData, error: recordError } = await client
      .from('inspection_records')
      .insert({
        inspection_id: parseInt(id),
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
    const isValidNumericId = itemId && !isNaN(parseInt(itemId)) && parseInt(itemId) > 0;
    
    let query = client
      .from('inspection_records')
      .update({
        ...recordUpdateData,
        updated_at: new Date().toISOString()
      })
      .eq('inspection_id', id);
    
    if (isValidNumericId) {
      query = query.eq('id', parseInt(itemId));
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

    // 更新验货状态为进行中
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

    // 尝试使用S3存储
    let photoUrl = '';
    try {
      const { storage } = await import('../storage/s3.js');
      const fileName = `${Date.now()}-${file.originalname}`;
      // 上传到对象存储，获取 key
      const key = await (storage as any).uploadFile({
        fileContent: file.buffer,
        fileName: fileName,
        contentType: file.mimetype
      });
      // 生成可访问的预签名 URL
      photoUrl = await (storage as any).generatePresignedUrl({ key });
      console.log('[UPLOAD_PHOTO] S3 photo URL:', photoUrl);
    } catch (storageError) {
      console.error('S3存储失败:', storageError);
      // 如果S3不可用，返回base64编码的数据
      const base64 = file.buffer.toString('base64');
      photoUrl = `data:${file.mimetype};base64,${base64}`;
    }

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

export default router;
