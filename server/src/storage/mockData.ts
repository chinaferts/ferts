// Mock data for development without Supabase
let checklists = [
  {
    id: '1',
    name: '服装验货清单',
    description: '适用于各类服装产品的验货检查',
    category: '服装',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '2',
    name: '电子产品验货清单',
    description: '适用于电子产品的验货检查',
    category: '电子',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '3',
    name: '家具验货清单',
    description: '适用于家具产品的验货检查',
    category: '家具',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

let checklistItems = [
  { id: '1', checklist_id: '1', name: '外观检查', description: '检查产品外观是否完好无损', order: 1, required: true, category: '外观' },
  { id: '2', checklist_id: '1', name: '尺寸测量', description: '测量产品尺寸是否符合规格', order: 2, required: true, category: '尺寸' },
  { id: '3', checklist_id: '1', name: '颜色核对', description: '核对产品颜色是否与订单一致', order: 3, required: true, category: '颜色' },
  { id: '4', checklist_id: '1', name: '功能测试', description: '测试产品功能是否正常', order: 4, required: false, category: '功能' },
  { id: '5', checklist_id: '1', name: '包装检查', description: '检查产品包装是否完整', order: 5, required: true, category: '包装' },
  { id: '6', checklist_id: '2', name: '电源测试', description: '测试电源是否正常工作', order: 1, required: true, category: '功能' },
  { id: '7', checklist_id: '2', name: '接口检查', description: '检查各类接口是否正常', order: 2, required: true, category: '外观' },
  { id: '8', checklist_id: '3', name: '结构检查', description: '检查家具结构是否牢固', order: 1, required: true, category: '结构' },
  { id: '9', checklist_id: '3', name: '表面处理', description: '检查表面是否光滑无瑕疵', order: 2, required: true, category: '外观' }
];

let inspections = [
  {
    id: '1',
    checklist_id: '1',
    supplier_name: '上海制衣厂',
    product_name: '男式衬衫',
    batch_number: 'B2024001',
    inspection_date: new Date().toISOString(),
    inspector: '张三',
    status: 'completed',
    total_items: 10,
    passed_items: 8,
    failed_items: 2,
    notes: '整体质量良好，有2处小瑕疵',
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    checklist_id: '2',
    supplier_name: '深圳电子厂',
    product_name: '蓝牙耳机',
    batch_number: 'E2024002',
    inspection_date: new Date().toISOString(),
    inspector: '李四',
    status: 'in_progress',
    total_items: 5,
    passed_items: 3,
    failed_items: 0,
    notes: '验货进行中',
    created_at: new Date().toISOString()
  }
];

let inspectionRecords: any[] = [];
let defects: any[] = [];

let nextChecklistId = 4;
let nextChecklistItemId = 10;
let nextInspectionId = 3;
let nextRecordId = 1;
let nextDefectId = 1;

export function mockGetChecklists() {
  return checklists;
}

export function mockGetChecklist(id: string) {
  const checklist = checklists.find(c => c.id === id);
  if (checklist) {
    return { ...checklist, checklist_items: mockGetChecklistItems(id) };
  }
  return null;
}

export function mockCreateChecklist(data: any) {
  const newChecklist = {
    id: String(nextChecklistId++),
    ...data,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  checklists.unshift(newChecklist);
  return newChecklist;
}

export function mockUpdateChecklist(id: string, data: any) {
  const index = checklists.findIndex(c => c.id === id);
  if (index !== -1) {
    checklists[index] = { ...checklists[index], ...data, updated_at: new Date().toISOString() };
    return checklists[index];
  }
  return null;
}

export function mockGetChecklistItems(checklistId: string) {
  return checklistItems.filter(i => i.checklist_id === checklistId).sort((a, b) => a.order - b.order);
}

export function mockCreateChecklistItem(data: any) {
  const newItem = {
    id: String(nextChecklistItemId++),
    ...data,
    order: data.order || checklistItems.filter(i => i.checklist_id === data.checklist_id).length + 1
  };
  checklistItems.push(newItem);
  return newItem;
}

export function mockDeleteChecklistItem(id: string) {
  const index = checklistItems.findIndex(i => i.id === id);
  if (index !== -1) {
    checklistItems.splice(index, 1);
    return true;
  }
  return false;
}

export function mockGetInspections(filters?: { status?: string; checklist_id?: string }) {
  let result = [...inspections];
  if (filters?.status) {
    result = result.filter(i => i.status === filters.status);
  }
  if (filters?.checklist_id) {
    result = result.filter(i => i.checklist_id === filters.checklist_id);
  }
  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function mockGetInspection(id: string) {
  const inspection = inspections.find(i => i.id === id);
  if (inspection) {
    let records = mockGetInspectionRecords(id);
    
    // 如果没有记录且使用了通用模板(id=0)，自动补充通用清单项
    if (records.length === 0 && String(inspection.checklist_id) === '0') {
      records = UNIVERSAL_CHECKLIST_ITEMS.map(item => ({
        id: String(nextRecordId++),
        inspection_id: id,
        checklist_item_id: item.id,
        item_name: item.name,
        item_description: item.description,
        item_category: item.category,
        result: 'unchecked',
        score: null,
        notes: null,
        created_at: new Date().toISOString()
      }));
      // 添加到全局记录中
      inspectionRecords.push(...records);
    }
    
    const defectList = mockGetDefects(id);
    return { ...inspection, inspection_records: records, defects: defectList };
  }
  return null;
}

// 通用验货模板清单项（硬编码）
const UNIVERSAL_CHECKLIST_ITEMS = [
  { id: 'u1', checklist_id: '0', name: '仓库照片', description: '拍摄大货仓库照片及码堆情况', category: '仓库', is_required: true, item_order: 1 },
  { id: 'u2', checklist_id: '0', name: '外箱检查', description: '检查外箱箱唛及尺寸重量', category: '外箱', is_required: true, item_order: 2 },
  { id: 'u3', checklist_id: '0', name: '内箱检查', description: '检查内箱唛头及规格重量', category: '内箱', is_required: true, item_order: 3 },
  { id: 'u4', checklist_id: '0', name: '产品细节', description: '拍摄产品细节、尺寸和重量照', category: '产品', is_required: true, item_order: 4 },
  { id: 'u5', checklist_id: '0', name: '彩盒检查', description: '检查彩盒信息及规格重量', category: '彩盒', is_required: true, item_order: 5 },
  { id: 'u6', checklist_id: '0', name: '条码扫描', description: '扫描所有含有条码的地方', category: '条码', is_required: true, item_order: 6 },
  { id: 'u7', checklist_id: '0', name: '签样对比', description: '与签样进行对比', category: '对比', is_required: true, item_order: 7 },
  { id: 'u8', checklist_id: '0', name: '组装测试', description: '按说明书指示组装并拍照', category: '组装', is_required: false, item_order: 8 }
];

export function mockCreateInspection(data: any) {
  const newInspection = {
    id: String(nextInspectionId++),
    ...data,
    status: 'pending',
    total_items: 0,
    passed_items: 0,
    failed_items: 0,
    created_at: new Date().toISOString()
  };
  inspections.unshift(newInspection);
  
  // 如果有 checklist_id，从模板复制清单项到 inspectionRecords
  if (data.checklist_id !== undefined && data.checklist_id !== null && data.checklist_id !== '') {
    let templateItems: any[] = [];
    
    // 如果是通用模板 (id=0 或 '0')
    if (String(data.checklist_id) === '0' || data.checklist_id === 0) {
      templateItems = UNIVERSAL_CHECKLIST_ITEMS;
    } else {
      templateItems = checklistItems.filter(item => String(item.checklist_id) === String(data.checklist_id));
    }
    
    templateItems.forEach(item => {
      inspectionRecords.push({
        id: String(nextRecordId++),
        inspection_id: newInspection.id,
        checklist_item_id: item.id,
        item_name: item.name,
        item_description: item.description,
        item_category: item.category,
        result: 'unchecked',
        score: null,
        notes: null,
        created_at: new Date().toISOString()
      });
    });
  }
  
  return newInspection;
}

export function mockUpdateInspection(id: string, data: any) {
  const index = inspections.findIndex(i => i.id === id);
  if (index !== -1) {
    inspections[index] = { ...inspections[index], ...data };
    return inspections[index];
  }
  return null;
}

export function mockGetInspectionRecords(inspectionId: string) {
  return inspectionRecords.filter(r => r.inspection_id === inspectionId);
}

export function mockCreateInspectionRecord(data: any) {
  const newRecord = {
    id: String(nextRecordId++),
    ...data,
    created_at: new Date().toISOString()
  };
  inspectionRecords.push(newRecord);
  return newRecord;
}

export function mockGetDefects(inspectionId?: string) {
  if (inspectionId) {
    return defects.filter(d => d.inspection_id === inspectionId);
  }
  return defects;
}

export function mockCreateDefect(data: any) {
  const newDefect = {
    id: String(nextDefectId++),
    ...data,
    created_at: new Date().toISOString()
  };
  defects.push(newDefect);
  return newDefect;
}

export function mockDeleteDefect(id: string) {
  const index = defects.findIndex(d => d.id === id);
  if (index !== -1) {
    defects.splice(index, 1);
    return true;
  }
  return false;
}

export function mockGetDashboardStats() {
  const total = inspections.length;
  const completedInspections = inspections.filter(i => i.status === 'completed');
  const inProgressCount = inspections.filter(i => i.status === 'in_progress').length;
  const pendingCount = inspections.filter(i => i.status === 'pending').length;
  const passedCount = completedInspections.filter(i => i.failed_items === 0).length;
  const passRate = completedInspections.length > 0 ? Math.round((passedCount / completedInspections.length) * 100) : 0;

  const recentInspections = inspections.slice(0, 5);
  const recentDefects = defects.slice(0, 5);

  return {
    total,
    completed: completedInspections.length,
    inProgress: inProgressCount,
    pending: pendingCount,
    passRate,
    recentInspections,
    recentDefects
  };
}

// 用户相关
interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'inspector';
  email?: string;
  phone?: string;
  created_at: string;
}

let users: User[] = [
  { id: '1', username: 'admin', name: '管理员', role: 'admin', email: 'admin@example.com', created_at: new Date().toISOString() },
  { id: '2', username: 'inspector', name: '验货员A', role: 'inspector', email: 'inspector1@example.com', created_at: new Date().toISOString() },
  { id: '3', username: 'inspector2', name: '验货员B', role: 'inspector', email: 'inspector2@example.com', created_at: new Date().toISOString() },
];

let currentUserId = '1'; // 默认管理员登录

export function getMockUsers(): User[] {
  return users;
}

export function getMockCurrentUser(): User | null {
  return users.find(u => u.id === currentUserId) || null;
}

export function updateMockUser(id: string, updates: Partial<Pick<User, 'name' | 'phone' | 'email'>>): User | null {
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return null;
  
  users[index] = { ...users[index], ...updates };
  return users[index];
}

export function createMockUser(data: { name: string; phone?: string; email?: string; role?: 'admin' | 'inspector' }): User {
  const id = (users.length + 1).toString();
  const username = `user${id}`;
  const newUser: User = {
    id,
    username,
    name: data.name,
    role: data.role || 'inspector',
    email: data.email,
    phone: data.phone,
    created_at: new Date().toISOString()
  };
  users.push(newUser);
  return newUser;
}

export function updateUserRole(id: string, role: 'admin' | 'inspector'): User | null {
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return null;
  
  users[index].role = role;
  return users[index];
}
