import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { isSupabaseConfigured, getSupabaseClient } from '../storage/supabase.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// 上传验货照片
router.post('/', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }

    const { inspection_id, defect_id, category } = req.body;
    const file = req.file;

    if (!isSupabaseConfigured()) {
      // Mock模式下返回模拟URL
      const mockUrl = `https://mock-storage.example.com/photos/${Date.now()}-${file.originalname}`;
      return res.json({
        success: true,
        data: {
          id: String(Date.now()),
          inspection_id,
          defect_id: defect_id || null,
          category: category || 'general',
          photo_url: mockUrl,
          created_at: new Date().toISOString()
        }
      });
    }

    // 尝试使用S3存储
    try {
      const { uploadFile } = await import('../storage/s3.js');
      const key = `inspections/${inspection_id}/${Date.now()}-${file.originalname}`;
      const url = await uploadFile(file.buffer, key, file.mimetype);

      const client = getSupabaseClient();
      const { data, error } = await client
        .from('inspection_photos')
        .insert({
          inspection_id,
          defect_id: defect_id || null,
          category: category || 'general',
          photo_url: url,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (storageError) {
      console.error('S3存储失败:', storageError);
      // 如果S3不可用，返回base64编码的数据
      const base64 = file.buffer.toString('base64');
      res.json({
        success: true,
        data: {
          id: String(Date.now()),
          inspection_id,
          defect_id: defect_id || null,
          category: category || 'general',
          photo_url: `data:${file.mimetype};base64,${base64}`,
          created_at: new Date().toISOString()
        }
      });
    }
  } catch (err: any) {
    console.error('上传照片失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取验货照片列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { inspection_id, defect_id } = req.query;

    if (!isSupabaseConfigured()) {
      return res.json({ success: true, data: [] });
    }

    const client = getSupabaseClient();
    let query = client.from('inspection_photos').select('*').order('created_at', { ascending: false });

    if (inspection_id) {
      query = query.eq('inspection_id', inspection_id);
    }
    if (defect_id) {
      query = query.eq('defect_id', defect_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('获取照片列表失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除照片
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isSupabaseConfigured()) {
      return res.json({ success: true });
    }

    const client = getSupabaseClient();
    const { error } = await client
      .from('inspection_photos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('删除照片失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
