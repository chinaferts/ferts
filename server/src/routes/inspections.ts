import { Router, type Request, type Response } from 'express';
import { isSupabaseConfigured, getSupabaseClient } from '../storage/supabase.js';
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
  mockGetDashboardStats
} from '../storage/mockData.js';

const router = Router();

// 获取验货列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, checklist_id } = req.query;

    if (!isSupabaseConfigured()) {
      const filters: any = {};
      if (status) filters.status = status as string;
      if (checklist_id) filters.checklist_id = checklist_id as string;
      return res.json({ success: true, data: mockGetInspections(filters) });
    }

    const client = getSupabaseClient();
    let query = client.from('inspections').select('*').order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (checklist_id) {
      query = query.eq('checklist_id', checklist_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('获取验货列表失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取仪表盘统计数据
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.json({ success: true, data: mockGetDashboardStats() });
    }

    const client = getSupabaseClient();
    
    const [totalResult, completedResult, inProgressResult, pendingResult] = await Promise.all([
      client.from('inspections').select('id', { count: 'exact' }),
      client.from('inspections').select('id', { count: 'exact' }).eq('status', 'completed'),
      client.from('inspections').select('id', { count: 'exact' }).eq('status', 'in_progress'),
      client.from('inspections').select('id', { count: 'exact' }).eq('status', 'pending')
    ]);

    const total = totalResult.count || 0;
    const completed = completedResult.count || 0;
    const inProgress = inProgressResult.count || 0;
    const pending = pendingResult.count || 0;

    const passRateResult = await client
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
    const { id } = req.params;

    if (!isSupabaseConfigured()) {
      const inspection = mockGetInspection(id);
      if (!inspection) {
        return res.status(404).json({ success: false, error: '验货记录不存在' });
      }
      return res.json({ success: true, data: inspection });
    }

    const client = getSupabaseClient();
    const { data: inspection, error } = await client
      .from('inspections')
      .select('*, inspection_records(*), defects(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ success: true, data: inspection });
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

    if (!isSupabaseConfigured()) {
      const newInspection = mockCreateInspection({
        checklist_id: templateId || checklist_id,
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

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('inspections')
      .insert({
        checklist_id: templateId || checklist_id,
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
        sample_size: sampleSize,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('创建验货记录失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 更新验货记录
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!isSupabaseConfigured()) {
      const updated = mockUpdateInspection(id, updateData);
      if (!updated) {
        return res.status(404).json({ success: false, error: '验货记录不存在' });
      }
      return res.json({ success: true, data: updated });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('inspections')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('更新验货记录失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 提交验货记录（完成验货）
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!isSupabaseConfigured()) {
      const records = mockGetInspectionRecords(id);
      const defects = mockGetDefects(id);
      
      const passedItems = records.filter((r: any) => r.result === 'passed').length;
      const failedItems = defects.length;
      
      const updated = mockUpdateInspection(id, {
        status: 'completed',
        total_items: records.length,
        passed_items: passedItems,
        failed_items: failedItems,
        notes
      });
      
      if (!updated) {
        return res.status(404).json({ success: false, error: '验货记录不存在' });
      }
      return res.json({ success: true, data: updated });
    }

    const client = getSupabaseClient();
    
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

    const { data, error } = await client
      .from('inspections')
      .update({
        status: 'completed',
        total_items: records?.length || 0,
        passed_items: passedItems,
        failed_items: failedItems,
        notes
      })
      .eq('id', id)
      .select()
      .single();

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

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('inspection_records')
      .insert({
        inspection_id: id,
        checklist_item_id,
        item_name,
        result,
        notes
      })
      .select()
      .single();

    if (error) throw error;

    // 更新验货状态为进行中
    await client
      .from('inspections')
      .update({ status: 'in_progress' })
      .eq('id', id)
      .eq('status', 'pending');

    res.json({ success: true, data });
  } catch (err: any) {
    console.error('添加验货记录项失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取验货记录项列表
router.get('/:id/records', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isSupabaseConfigured()) {
      return res.json({ success: true, data: mockGetInspectionRecords(id) });
    }

    const client = getSupabaseClient();
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

export default router;
