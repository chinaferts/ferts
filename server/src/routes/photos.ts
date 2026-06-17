import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { isSupabaseConfigured, requireSupabaseClient } from '../storage/supabase.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// 上传验货照片
router.post('/', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }

    const { inspection_id, defect_id, category, record_id } = req.body;
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
          record_id: record_id || null,
          photo_url: mockUrl,
          created_at: new Date().toISOString()
        }
      });
    }

    // 尝试使用S3存储
    try {
      const { storage } = await import('../storage/s3.js');
      const key = `inspections/${inspection_id}/${Date.now()}-${file.originalname}`;
      // 使用 uploadBuffer 方法上传文件
      const url = await (storage as any).uploadBuffer(file.buffer, key, file.mimetype);

      const client = requireSupabaseClient();
      
      // 先尝试包含 record_id 的插入
      let data, error;
      try {
        const insertData: any = {
          inspection_id,
          defect_id: defect_id || null,
          category: category || 'general',
          photo_url: url,
          created_at: new Date().toISOString()
        };
        // 只有当 record_id 存在时才添加
        if (record_id) {
          insertData.record_id = record_id;
        }
        
        const result = await client!
          .from('inspection_photos')
          .insert(insertData)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } catch (e) {
        error = e;
      }
      
      // 如果失败，尝试不带 record_id
      if (error) {
        console.log('插入照片失败，尝试不带record_id:', error);
        const result = await client!
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
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      res.json({ success: true, data: { ...data, record_id } });
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
          record_id: record_id || null,
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

    const client = requireSupabaseClient();
    let query = client!.from('inspection_photos').select('*').order('created_at', { ascending: false });

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

    const client = requireSupabaseClient();
    const { error } = await client!
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

// 下载照片（代理模式，解决跨域和认证问题）
router.get('/download', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: '缺少URL参数' });
      return;
    }

    console.log('[Photo Download] 代理下载:', url);

    // 处理本地文件路径（如 /uploads/photos/xxx.jpg）
    if (url.startsWith('/uploads/')) {
      const fs = await import('fs');
      const path = await import('path');
      
      // 根据环境确定上传目录
      const isProduction = process.env.NODE_ENV === 'production';
      const baseUploadsDir = isProduction ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');
      
      // 构造本地文件绝对路径
      const relativePath = url.startsWith('/uploads/') ? url.substring('/uploads/'.length) : url;
      const filePath = path.join(baseUploadsDir, relativePath);
      
      // 安全检查：确保路径在 uploads 目录下
      const normalizedPath = path.normalize(filePath);
      if (!normalizedPath.startsWith(path.normalize(baseUploadsDir))) {
        res.status(403).json({ success: false, error: '路径访问被拒绝' });
        return;
      }
      
      if (!fs.existsSync(normalizedPath)) {
        console.error('[Photo Download] 本地文件不存在:', normalizedPath);
        res.status(404).json({ success: false, error: '文件不存在' });
        return;
      }
      
      const ext = path.extname(normalizedPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      const buffer = fs.readFileSync(normalizedPath);
      
      console.log('[Photo Download] 本地文件大小:', buffer.length);
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
      return;
    }

    // 检查是否是支持的存储类型（外部URL）
    if (url.includes('coze-storage') || url.includes('supabase') || url.startsWith('https://')) {
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error('[Photo Download] 获取照片失败:', response.status, response.statusText);
          res.status(502).json({ success: false, error: `获取照片失败: ${response.status}` });
          return;
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        console.log('[Photo Download] 照片大小:', buffer.byteLength, '类型:', contentType);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.byteLength);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(Buffer.from(buffer));
        return;
      } catch (fetchError) {
        console.error('[Photo Download] fetch失败:', fetchError);
        res.status(502).json({ success: false, error: '获取照片失败' });
        return;
      }
    }

    res.status(400).json({ success: false, error: '不支持的照片URL' });
  } catch (err: any) {
    console.error('下载照片失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
