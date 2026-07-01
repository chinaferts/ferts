import { Router } from 'express';
import { getSupabaseClient } from '../storage/supabase';

const router = Router();

// ============ 登录 ============
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, name, role, email, phone, created_at')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    res.json(user);
  } catch (error: any) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// ============ 获取当前用户 ============
router.get('/me', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, name, role, email, phone, created_at')
      .eq('id', Number(id))
      .single();

    if (error || !user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(user);
  } catch (error: any) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// ============ 获取所有用户（不含密码） ============
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, name, role, email, phone, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(users || []);
  } catch (error: any) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// ============ 管理员获取所有用户（含密码） ============
router.get('/all-with-password', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(users || []);
  } catch (error: any) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// ============ 创建用户 ============
router.post('/', async (req, res) => {
  try {
    const { username, password, name, role, email, phone } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: '用户名、密码和姓名不能为空' });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }

    // 检查用户名是否已存在
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        username,
        password,
        name,
        role: role || 'inspector',
        email: email || null,
        phone: phone || null,
      })
      .select('id, username, name, role, email, phone, created_at')
      .single();

    if (error) throw error;
    res.status(201).json(user);
  } catch (error: any) {
    console.error('创建用户失败:', error);
    res.status(500).json({ error: '创建用户失败' });
  }
});

// ============ 更新用户 ============
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', Number(id))
      .select('id, username, name, role, email, phone, created_at')
      .single();

    if (error) throw error;
    res.json(user);
  } catch (error: any) {
    console.error('更新用户失败:', error);
    res.status(500).json({ error: '更新用户失败' });
  }
});

// ============ 删除用户 ============
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', Number(id));

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

export default router;
