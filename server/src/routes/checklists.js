import { Router } from 'express';
import { isSupabaseConfigured, getSupabaseClient, requireSupabaseClient } from '../storage/supabase.js';
import { mockGetChecklists, mockGetChecklist, mockCreateChecklist, mockUpdateChecklist, mockGetChecklistItems, mockCreateChecklistItem, mockDeleteChecklistItem } from '../storage/mockData.js';
const router = Router();
// 获取所有清单列表
router.get('/', async (req, res) => {
    try {
        if (!isSupabaseConfigured()) {
            return res.json({ success: true, data: mockGetChecklists() });
        }
        const client = requireSupabaseClient();
        const { data, error } = await client
            .from('checklists')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        // 添加通用验货模板（始终显示在最前面）
        const universalTemplate = {
            id: 'universal',
            name: '通用验货模板',
            description: '适用于所有产品的通用验货检查清单',
            categories: 6,
            items: 6,
            usageCount: 0,
            updatedAt: new Date().toISOString(),
            is_universal: true
        };
        res.json({ success: true, data: [universalTemplate, ...(data || [])] });
    }
    catch (err) {
        console.error('获取清单列表失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
// 获取单个清单详情
router.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // 通用模板使用 mock 数据
        if (id === 'universal' || !isSupabaseConfigured()) {
            const checklist = mockGetChecklist(id);
            if (!checklist) {
                return res.status(404).json({ success: false, error: '清单不存在' });
            }
            return res.json({ success: true, data: checklist });
        }
        const client = requireSupabaseClient();
        const { data, error } = await client
            .from('checklists')
            .select('*, checklist_items(*)')
            .eq('id', id)
            .single();
        if (error)
            throw error;
        res.json({ success: true, data });
    }
    catch (err) {
        console.error('获取清单详情失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
// 创建新清单
router.post('/', async (req, res) => {
    try {
        const { name, description, category, items } = req.body;
        if (!isSupabaseConfigured()) {
            const newChecklist = mockCreateChecklist({ name, description, category });
            // 同时创建关联的检查项
            if (items && items.length > 0) {
                items.forEach((item, index) => {
                    mockCreateChecklistItem({
                        checklist_id: newChecklist.id,
                        name: item.name,
                        description: item.description,
                        required: item.required || false,
                        category: item.category || '其他',
                        order: index + 1
                    });
                });
            }
            return res.json({ success: true, data: mockGetChecklist(newChecklist.id) });
        }
        const client = requireSupabaseClient();
        const { data: checklist, error: checklistError } = await client
            .from('checklists')
            .insert({ name, description, category, is_active: true })
            .select()
            .single();
        if (checklistError)
            throw checklistError;
        // 如果有检查项，一并创建
        if (items && items.length > 0) {
            const itemsToInsert = items.map((item, index) => ({
                checklist_id: checklist.id,
                name: item.name,
                description: item.description,
                required: item.required || false,
                category: item.category || '其他',
                order: index + 1
            }));
            const { error: itemsError } = await client
                .from('checklist_items')
                .insert(itemsToInsert);
            if (itemsError)
                throw itemsError;
        }
        // 重新获取完整数据
        const { data: result, error: fetchError } = await client
            .from('checklists')
            .select('*, checklist_items(*)')
            .eq('id', checklist.id)
            .single();
        if (fetchError)
            throw fetchError;
        res.json({ success: true, data: result });
    }
    catch (err) {
        console.error('创建清单失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
// 更新清单
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { name, description, category, categories } = req.body;
        // 通用模板使用 mock 数据
        if (id === 'universal' || !isSupabaseConfigured()) {
            // 通用模板使用新的 categories 格式
            if (id === 'universal') {
                const updated = mockUpdateChecklist(id, { name, description, categories });
                if (!updated) {
                    return res.status(404).json({ success: false, error: '清单不存在' });
                }
                return res.json({ success: true, data: updated });
            }
            // 普通 mock 模板：转换 categories 格式
            const categoryData = (categories || []).map((cat, idx) => ({
                category_id: cat.id || idx + 1,
                category_name: cat.name,
                items: (cat.items || []).map((item, i) => ({
                    item_id: i + 1,
                    item_name: item,
                    is_critical: false,
                })),
            }));
            const updated = mockUpdateChecklist(id, { name, description, category: categoryData });
            if (!updated) {
                return res.status(404).json({ success: false, error: '清单不存在' });
            }
            return res.json({ success: true, data: updated });
        }
        const client = requireSupabaseClient();
        const { data, error } = await client
            .from('checklists')
            .update({ name, description, category, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        res.json({ success: true, data });
    }
    catch (err) {
        console.error('更新清单失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
// 删除清单
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (!isSupabaseConfigured()) {
            mockUpdateChecklist(id, { is_active: false });
            return res.json({ success: true });
        }
        const client = requireSupabaseClient();
        const { error } = await client
            .from('checklists')
            .update({ is_active: false })
            .eq('id', id);
        if (error)
            throw error;
        res.json({ success: true });
    }
    catch (err) {
        console.error('删除清单失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
// 添加检查项到清单
router.post('/:id/items', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, required, category } = req.body;
        if (!isSupabaseConfigured()) {
            const newItem = mockCreateChecklistItem({
                checklist_id: id,
                name,
                description,
                required: required || false,
                category: category || '其他'
            });
            return res.json({ success: true, data: newItem });
        }
        const client = requireSupabaseClient();
        const { data: items, error: fetchError } = await client
            .from('checklist_items')
            .select('order')
            .eq('checklist_id', id)
            .order('order', { ascending: false })
            .limit(1);
        const order = items && items.length > 0 ? items[0].order + 1 : 1;
        const { data, error } = await client
            .from('checklist_items')
            .insert({
            checklist_id: id,
            name,
            description,
            required: required || false,
            category: category || '其他',
            order
        })
            .select()
            .single();
        if (error)
            throw error;
        res.json({ success: true, data });
    }
    catch (err) {
        console.error('添加检查项失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
// 删除检查项
router.delete('/:checklistId/items/:itemId', async (req, res) => {
    try {
        const itemId = req.params.itemId;
        if (!isSupabaseConfigured()) {
            mockDeleteChecklistItem(itemId);
            return res.json({ success: true });
        }
        const client = requireSupabaseClient();
        const { error } = await client
            .from('checklist_items')
            .delete()
            .eq('id', itemId);
        if (error)
            throw error;
        res.json({ success: true });
    }
    catch (err) {
        console.error('删除检查项失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
export default router;
