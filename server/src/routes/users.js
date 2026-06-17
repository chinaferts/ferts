import { Router } from 'express';
import { getMockUsers, getMockCurrentUser, updateMockUser, createMockUser, updateUserRole, deleteMockUser } from '../storage/mockData';
const router = Router();
// 获取所有用户
router.get('/', (req, res) => {
    const users = getMockUsers();
    // 不返回密码给前端
    const safeUsers = users.map(u => {
        const { password, ...rest } = u;
        return rest;
    });
    res.json(safeUsers);
});
// 管理员获取所有用户（包括密码）
router.get('/all-with-password', (req, res) => {
    // 简单验证是否为管理员（实际应用中应通过session验证）
    const authHeader = req.headers['x-user-role'];
    if (authHeader !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    const users = getMockUsers();
    res.json(users);
});
// 登录
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    // 检查是否在Mock用户列表中
    const users = getMockUsers();
    const user = users.find(u => u.username === username);
    if (user && user.password === password) {
        // 登录成功，不返回密码
        const { password: _, ...safeUser } = user;
        return res.json(safeUser);
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
    const { name, phone, email, password } = req.body;
    const updatedUser = updateMockUser(id, { name, phone, email, password });
    if (!updatedUser) {
        return res.status(404).json({ error: '用户不存在' });
    }
    // 不返回密码
    const { password: _, ...safeUser } = updatedUser;
    res.json(safeUser);
});
// 创建新用户
router.post('/', (req, res) => {
    const { name, phone, email, role = 'inspector', password } = req.body;
    if (!name) {
        return res.status(400).json({ error: '姓名不能为空' });
    }
    const newUser = createMockUser({ name, phone, email, role, password });
    // 不返回密码
    const { password: _, ...safeUser } = newUser;
    res.status(201).json(safeUser);
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
// 删除用户
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    // 不允许删除自己
    const currentUser = getMockCurrentUser();
    if (currentUser && currentUser.id === id) {
        return res.status(400).json({ error: '不能删除自己' });
    }
    const deleted = deleteMockUser(id);
    if (!deleted) {
        return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ success: true, message: '用户已删除' });
});
export default router;
