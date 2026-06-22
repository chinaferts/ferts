import { Router } from 'express';
import { getSupabaseClient } from '../storage/supabase';

const router = Router();

// 获取所有用户
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

// 管理员获取所有用户（包括密码）
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

// 登录
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
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username);
    
    if (error) throw error;
    
    const user = users?.[0];
    if (user && user.password === password) {
      // 登录成功，不返回密码
      const { password: _, ...safeUser } = user;
      return res.json(safeUser);
    }
    
    res.status(401).json({ error: '用户名或密码错误' });
  } catch (error: any) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    // 从请求头获取当前用户ID（登录时前端会存储）
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ error: '未登录' });
    }
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, name, role, email, phone, created_at')
      .eq('id', userId);
    
    if (error) throw error;
    
    if (!users || users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(users[0]);
  } catch (error: any) {
    console.error('获取当前用户失败:', error);
    res.status(500).json({ error: '获取当前用户失败' });
  }
});

// 获取单个用户
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, name, role, email, phone, created_at')
      .eq('id', id);
    
    if (error) throw error;
    
    if (!users || users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(users[0]);
  } catch (error: any) {
    console.error('获取用户失败:', error);
    res.status(500).json({ error: '获取用户失败' });
  }
});

// 更新用户信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, password } = req.body;
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (password !== undefined) updates.password = password;
    
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, username, name, role, email, phone, created_at')
      .single();
    
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(data);
  } catch (error: any) {
    console.error('更新用户失败:', error);
    res.status(500).json({ error: '更新用户失败' });
  }
});

// 创建新用户
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, role = 'inspector', password, username } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '姓名不能为空' });
    }
    
    if (!password) {
      return res.status(400).json({ error: '密码不能为空' });
    }
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }
    
    // 生成用户名
    const { data: countData } = await supabase.from('users').select('id', { count: 'exact' });
    const newUsername = username || `user${(countData?.length || 0) + 1}`;
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        username: newUsername,
        name,
        phone: phone || null,
        email: email || null,
        role,
        password
      })
      .select('id, username, name, role, email, phone, created_at')
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: '用户名已存在' });
      }
      throw error;
    }
    
    res.status(201).json(data);
  } catch (error: any) {
    console.error('创建用户失败:', error);
    res.status(500).json({ error: '创建用户失败' });
  }
});

// 更新用户角色
router.put('/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!role || !['admin', 'inspector'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: '数据库未配置' });
    }
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .select('id, username, name, role, email, phone, created_at')
      .single();
    
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(data);
  } catch (error: any) {
    console.error('更新用户角色失败:', error);
    res.status(500).json({ error: '更新用户角色失败' });
  }
});

// 删除用户
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
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

export default router;
