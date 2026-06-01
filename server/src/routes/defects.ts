import { Router, type Request, type Response } from 'express';
import { isSupabaseConfigured, getSupabaseClient } from '../storage/supabase.js';
import { mockGetDefects, mockCreateDefect, mockDeleteDefect } from '../storage/mockData.js';

const router = Router();

// 获取缺陷列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { inspection_id } = req.query;

    if (!isSupabaseConfigured()) {
      let defects = mockGetDefects();
      if (inspection_id) {
        defects = defects.filter((d: any) => d.inspection_id === inspection_id);
      }
      return res.json({ success: true, data: defects });
    }

    const client = getSupabaseClient();
    let query = client.from('defects').select('*').order('created_at', { ascending: false });

    if (inspection_id) {
      query = query.eq('inspection_id', inspection_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('获取缺陷列表失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 创建缺陷记录
router.post('/', async (req: Request, res: Response) => {
  try {
    const { inspection_id, defect_type, severity, description, location } = req.body;

    if (!isSupabaseConfigured()) {
      const newDefect = mockCreateDefect({
        inspection_id,
        defect_type,
        severity,
        description,
        location
      });
      return res.json({ success: true, data: newDefect });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('defects')
      .insert({
        inspection_id,
        defect_type,
        severity,
        description,
        location
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('创建缺陷记录失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除缺陷记录
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isSupabaseConfigured()) {
      mockDeleteDefect(id);
      return res.json({ success: true });
    }

    const client = getSupabaseClient();
    const { error } = await client
      .from('defects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('删除缺陷记录失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
