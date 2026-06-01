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

let inspectionRecords = [];
let defects = [];

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
    const records = mockGetInspectionRecords(id);
    const defectList = mockGetDefects(id);
    return { ...inspection, inspection_records: records, defects: defectList };
  }
  return null;
}

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
