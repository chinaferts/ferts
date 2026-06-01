import { Router } from 'express';
import { getMockUsers, getMockCurrentUser, updateMockUser, createMockUser, updateUserRole } from '../storage/mockData';

const router = Router();

// 获取所有用户
router.get('/', (req, res) => {
  const users = getMockUsers();
  res.json(users);
});

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  
  // 简单的Mock验证
  if (username === 'admin' && password === '123456') {
    const user = {
      id: '1',
      username: 'admin',
      name: '管理员',
      role: 'admin' as const,
      email: 'admin@example.com',
    };
    return res.json(user);
  }
  
  if (username === 'inspector' && password === '123456') {
    const user = {
      id: '2',
      username: 'inspector',
      name: '验货员',
      role: 'inspector' as const,
      email: 'inspector@example.com',
    };
    return res.json(user);
  }
  
  // 检查是否在Mock用户列表中
  const users = getMockUsers();
  const user = users.find(u => u.username === username);
  if (user) {
    return res.json(user);
  }
  
  res.status(401).json({ error: '用户名或密码错误' });
});

// 获取当前用户信息
router.get('/me', (req, res) => {
  const user = getMockCurrentUser();
  res.json(user);
});

// 获取单个用户
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const users = getMockUsers();
  const user = users.find(u => u.id === id);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  res.json(user);
});

// 更新用户信息
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, email } = req.body;
  
  const updatedUser = updateMockUser(id, { name, phone, email });
  
  if (!updatedUser) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  res.json(updatedUser);
});

// 创建新用户
router.post('/', (req, res) => {
  const { name, phone, email, role = 'inspector' } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '姓名不能为空' });
  }
  
  const newUser = createMockUser({ name, phone, email, role });
  res.status(201).json(newUser);
});

// 更新用户角色
router.put('/:id/role', (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  if (!role || !['admin', 'inspector'].includes(role)) {
    return res.status(400).json({ error: '无效的角色' });
  }
  
  const updatedUser = updateUserRole(id, role);
  
  if (!updatedUser) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  res.json(updatedUser);
});

export default router;
