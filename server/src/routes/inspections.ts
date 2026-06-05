import { Router, type Request, type Response } from 'express';
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
      // 使用嵌入式 UNIVERSAL_CHECKLIST_ITEMS 生成验货详情和清单项
      const universalItems = UNIVERSAL_CHECKLIST_ITEMS.map((item, index) => ({
        id: `generated-${inspection.id}-${index}`,
        checklist_item_id: item.id,
        item_name: item.name,
        item_description: item.description,
        item_category: item.category,
        result: 'unchecked',
        score: null,
        notes: null,
        photos: [],
        created_at: new Date().toISOString()
      }));
      
      return res.json({
        success: true,
        data: {
          ...inspection,
          checklist_items: universalItems,
          categories: [...new Set(universalItems.map((item: any) => item.item_category))],
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
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.item_type || 'general',
        status: record.result || 'unchecked',
        notes: record.notes,
        score: record.score,
        record_id: record.id,
        photos: photos?.filter((p: any) => p.record_id === record.id).map((p: any) => p.photo_url) || []
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
    
    // 获取记录数和缺陷数
    const { data: records } = await client
      .from('inspection_records')
      .select('result')
      .eq('inspection_id', id);

    const { data: defects } = await client
      .from('defects')
      .select('id')
      .eq('inspection_id', id);

    const passedItems = records?.filter((r: any) => r.result === 'passed').length || 0;
    const failedItems = defects?.length || 0;

    // 构建更新对象，只包含实际存在的字段
    const updateData: any = {
      status: 'completed',
      notes
    };

    // 如果表中有这些字段才添加
    if (records && records.length !== undefined) {
      updateData.total_items = records.length;
    }
    if (passedItems !== undefined) {
      updateData.passed_items = passedItems;
    }

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
    const { result, notes } = req.body;

    if (!isSupabaseConfigured()) {
      return res.json({ success: true, data: { id: recordId, result, notes } });
    }

    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('inspection_records')
      .update({
        result: result,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId)
      .eq('inspection_id', id)
      .select();

    // 如果 select() 返回多条记录，取第一条
    const updatedRecord = Array.isArray(data) ? data[0] : data;

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

// 上传检查照片
router.post('/:id/photos', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { record_id } = req.body; // 清单项记录ID
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: '请上传图片文件' });
    }

    const photoUrl = `/uploads/${file.filename}`;

    if (!isSupabaseConfigured()) {
      // Mock 模式：返回成功响应
      return res.json({ success: true, data: { photoUrl, inspection_id: id, record_id } });
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
