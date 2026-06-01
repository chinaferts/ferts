import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal } from 'react-native';
import { Screen } from '@/components/Screen';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';

interface ChecklistItem {
  id: number;
  name: string;
}

interface ChecklistCategory {
  id: number;
  name: string;
  items: ChecklistItem[];
}

interface ChecklistDetail {
  id: number;
  name: string;
  description: string;
  categories: ChecklistCategory[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function ChecklistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useSafeRouter();
  const [template, setTemplate] = useState<ChecklistDetail | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ChecklistDetail | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTemplate = async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/checklists/${id}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        setTemplate({
          id: data.id,
          name: data.name,
          description: data.description || '',
          categories: ((data.categories || data.category) || []).map((cat: any, idx: number) => ({
            id: cat.id || cat.category_id || `cat_${idx}`,
            name: cat.name || cat.category_name || cat.category_name || '',
            items: (cat.items || []).map((item: any, i: number) => ({
              id: typeof item === 'object' ? (item.item_id || item.id || i) : i,
              name: typeof item === 'object' ? (item.item_name || item.name) : item,
              isCritical: typeof item === 'object' ? (item.is_critical || item.isCritical || false) : false,
            })),
          })),
          usageCount: data.usage_count || data.usageCount || 0,
          createdAt: data.created_at || data.createdAt || '',
          updatedAt: data.updated_at || data.updatedAt || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch template:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTemplate();
    }, [id])
  );

  const startEditing = () => {
    if (template) {
      setEditData({ ...template });
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setEditData(null);
    setIsEditing(false);
    setNewCategoryName('');
    setNewItemName('');
  };

  const saveTemplate = async () => {
    if (!editData || !editData.name.trim()) {
      Alert.alert('错误', '请输入模板名称');
      return;
    }
    
    setSaving(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/checklists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          description: editData.description,
          categories: editData.categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            items: cat.items.map(item => item.name),
          })),
        }),
      });
      
      if (response.ok) {
        Alert.alert('成功', '模板已保存', [
          {
            text: '确定',
            onPress: () => router.back(),
          },
        ]);
        setIsEditing(false);
        setEditData(null);
        fetchTemplate();
      } else {
        Alert.alert('错误', '保存失败');
      }
    } catch (error) {
      Alert.alert('错误', '保存失败');
    }
    setSaving(false);
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) {
      Alert.alert('错误', '请输入分类名称');
      return;
    }
    if (editData) {
      setEditData({
        ...editData,
        categories: [
          ...editData.categories,
          { id: Date.now(), name: newCategoryName.trim(), items: [] },
        ],
      });
      setNewCategoryName('');
      setShowCategoryModal(false);
    }
  };

  const deleteCategory = (categoryId: number) => {
    if (editData) {
      setEditData({
        ...editData,
        categories: editData.categories.filter(c => c.id !== categoryId),
      });
    }
  };

  const addItem = () => {
    if (!newItemName.trim()) {
      Alert.alert('错误', '请输入检查项名称');
      return;
    }
    if (editData && selectedCategoryId !== null) {
      setEditData({
        ...editData,
        categories: editData.categories.map(cat =>
          cat.id === selectedCategoryId
            ? { ...cat, items: [...cat.items, { id: Date.now(), name: newItemName.trim() }] }
            : cat
        ),
      });
      setNewItemName('');
      setShowItemModal(false);
    }
  };

  const deleteItem = (categoryId: number, itemId: number) => {
    if (editData) {
      setEditData({
        ...editData,
        categories: editData.categories.map(cat =>
          cat.id === categoryId
            ? { ...cat, items: cat.items.filter(i => i.id !== itemId) }
            : cat
        ),
      });
    }
  };

  if (!template) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </Screen>
    );
  }

  const displayData = isEditing && editData ? editData : template;

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* 头部信息 */}
        <View style={styles.headerCard}>
          <View style={styles.headerIcon}>
            <Feather name="list" size={32} color="#6C63FF" />
          </View>
          
          {isEditing ? (
            <>
              <TextInput
                style={styles.editNameInput}
                value={editData?.name || ''}
                onChangeText={(text) => setEditData(editData ? { ...editData, name: text } : null)}
                placeholder="模板名称"
                placeholderTextColor="#999"
              />
              <TextInput
                style={styles.editDescInput}
                value={editData?.description || ''}
                onChangeText={(text) => setEditData(editData ? { ...editData, description: text } : null)}
                placeholder="模板描述"
                placeholderTextColor="#999"
                multiline
              />
            </>
          ) : (
            <>
              <Text style={styles.templateName}>{template.name}</Text>
              <Text style={styles.templateDescription}>{template.description}</Text>
            </>
          )}
          
          {!isEditing && (
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Feather name="folder" size={16} color="#636E72" />
                <Text style={styles.metaText}>{template.categories.length} 分类</Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="check-square" size={16} color="#636E72" />
                <Text style={styles.metaText}>
                  {template.categories.reduce((sum, c) => sum + c.items.length, 0)} 检查项
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="trending-up" size={16} color="#636E72" />
                <Text style={styles.metaText}>使用 {template.usageCount} 次</Text>
              </View>
            </View>
          )}
        </View>

        {/* 检查项列表 */}
        {displayData.categories.map(category => (
          <View key={category.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{category.name}</Text>
              {isEditing && (
                <TouchableOpacity onPress={() => deleteCategory(category.id)}>
                  <Feather name="trash-2" size={20} color="#FF6B6B" />
                </TouchableOpacity>
              )}
            </View>
            {category.items.map((item, idx) => (
              <View key={item.id} style={styles.checklistItem}>
                <View style={styles.itemNumber}>
                  <Text style={styles.itemNumberText}>{idx + 1}</Text>
                </View>
                <Text style={styles.itemName}>{item.name}</Text>
                {isEditing && (
                  <TouchableOpacity
                    style={styles.deleteItemBtn}
                    onPress={() => deleteItem(category.id, item.id)}
                  >
                    <Feather name="x" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {isEditing && (
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => {
                  setSelectedCategoryId(category.id);
                  setShowItemModal(true);
                }}
              >
                <Feather name="plus" size={18} color="#6C63FF" />
                <Text style={styles.addItemText}>添加检查项</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* 添加分类按钮 */}
        {isEditing && (
          <TouchableOpacity
            style={styles.addCategoryBtn}
            onPress={() => setShowCategoryModal(true)}
          >
            <Feather name="plus" size={20} color="#6C63FF" />
            <Text style={styles.addCategoryText}>添加分类</Text>
          </TouchableOpacity>
        )}

        {/* 操作按钮 */}
        <View style={styles.actions}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={saveTemplate}
                disabled={saving}
              >
                <Feather name="check" size={18} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>{saving ? '保存中...' : '保存'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelEditing}>
                <Feather name="x" size={18} color="#636E72" />
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.editButton} onPress={startEditing}>
                <Feather name="edit-2" size={18} color="#6C63FF" />
                <Text style={styles.editButtonText}>编辑模板</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.useButton}
                onPress={() => {
                  Alert.alert(
                    '使用模板',
                    '确定要使用此模板创建验货任务吗？',
                    [
                      { text: '取消', style: 'cancel' },
                      { text: '确定', onPress: () => router.navigate('/inspections/new') },
                    ]
                  );
                }}
              >
                <Feather name="check-circle" size={18} color="#FFFFFF" />
                <Text style={styles.useButtonText}>使用此模板</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* 添加分类Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>添加分类</Text>
            <TextInput
              style={styles.modalInput}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="请输入分类名称"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => {
                  setNewCategoryName('');
                  setShowCategoryModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={addCategory}
              >
                <Text style={styles.modalConfirmText}>添加</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 添加检查项Modal */}
      <Modal visible={showItemModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>添加检查项</Text>
            <TextInput
              style={styles.modalInput}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder="请输入检查项名称"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => {
                  setNewItemName('');
                  setShowItemModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={addItem}
              >
                <Text style={styles.modalConfirmText}>添加</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F3',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#636E72',
  },
  headerCard: {
    backgroundColor: '#F0F0F3',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(108,99,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  templateName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2D3436',
    textAlign: 'center',
    marginBottom: 8,
  },
  templateDescription: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  editNameInput: {
    width: '100%',
    fontSize: 22,
    fontWeight: '800',
    color: '#2D3436',
    textAlign: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  editDescInput: {
    width: '100%',
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 20,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minHeight: 60,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#636E72',
  },
  section: {
    backgroundColor: '#F0F0F3',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 16,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
  },
  itemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(108,99,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C63FF',
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    color: '#2D3436',
  },
  deleteItemBtn: {
    padding: 4,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#6C63FF',
    borderRadius: 12,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addItemText: {
    fontSize: 14,
    color: '#6C63FF',
    marginLeft: 6,
  },
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#6C63FF',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  addCategoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C63FF',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    gap: 8,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C63FF',
  },
  useButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    gap: 8,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  useButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#10B981',
    borderRadius: 16,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2D3436',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#F5F5F5',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
  },
  modalConfirmBtn: {
    backgroundColor: '#6C63FF',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
