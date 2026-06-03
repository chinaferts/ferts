import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';

interface ChecklistTemplate {
  id: number;
  name: string;
  description: string;
  categories: number;
  items: number;
  usageCount: number;
  updatedAt: string;
}

export default function ChecklistsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<ChecklistTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 检查用户角色
  useEffect(() => {
    const checkRole = async () => {
      try {
        const stored = await AsyncStorage.getItem('@auth_user');
        if (stored) {
          const userData = JSON.parse(stored);
          setIsAdmin(userData.role === 'admin');
        }
      } catch (error) {
        console.error('Failed to check role:', error);
      }
    };
    checkRole();
  }, []);

  const fetchTemplates = async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/checklists`);
      if (response.ok) {
        const result = await response.json();
        const list = result.data || result || [];
        setTemplates(list.map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description || '',
          categories: t.category_count || 0,
          items: t.item_count || 0,
          usageCount: t.usage_count || 0,
          updatedAt: t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '',
        })));
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTemplates();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTemplates();
    setRefreshing(false);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || creating) return;
    
    setCreating(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/checklists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTemplateName.trim(), description: '' }),
      });
      if (response.ok) {
        setNewTemplateName('');
        setModalVisible(false);
        fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to create template:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate || deleting) return;
    
    setDeleting(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/checklists/${deletingTemplate.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setDeleteModalVisible(false);
        setDeletingTemplate(null);
        fetchTemplates();
      } else {
        Alert.alert('删除失败', '无法删除该模板');
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      Alert.alert('删除失败', '网络错误，请重试');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = (template: ChecklistTemplate) => {
    setDeletingTemplate(template);
    setDeleteModalVisible(true);
  };

  const renderTemplateCard = ({ item }: { item: ChecklistTemplate }) => (
    <View style={styles.cardOuter}>
      <Link href={`/checklists/${item.id}`} style={styles.cardLink}>
        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Feather name="list" size={22} color="#6C63FF" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
            </View>
            {isAdmin && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => confirmDelete(item)}
              >
                <Feather name="trash-2" size={18} color="#E74C3C" />
              </TouchableOpacity>
            )}
            <Feather name="chevron-right" size={20} color="#B2BEC3" />
          </View>
        
          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Feather name="folder" size={14} color="#636E72" />
              <Text style={styles.metaText}>{item.categories} 分类</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="check-square" size={14} color="#636E72" />
              <Text style={styles.metaText}>{item.items} 检查项</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="trending-up" size={14} color="#636E72" />
              <Text style={styles.metaText}>使用 {item.usageCount} 次</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.updateInfo}>
              <Feather name="clock" size={12} color="#B2BEC3" />
              <Text style={styles.updateText}>更新于 {item.updatedAt}</Text>
            </View>
          </View>
        </View>
      </Link>
    </View>
  );

  return (
    <Screen>
      <View style={styles.container}>
        {/* 统计概览 */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(108,99,255,0.15)' }]}>
              <Feather name="list" size={20} color="#6C63FF" />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statValue}>{templates.length}</Text>
              <Text style={styles.statLabel}>模板总数</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(0,184,148,0.15)' }]}>
              <Feather name="check-circle" size={20} color="#00B894" />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statValue}>{templates.reduce((sum, t) => sum + t.usageCount, 0)}</Text>
              <Text style={styles.statLabel}>累计使用</Text>
            </View>
          </View>
        </View>

        {/* 模板列表 */}
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTemplateCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="inbox" size={64} color="#B2BEC3" />
              <Text style={styles.emptyTitle}>暂无验货模板</Text>
              <Text style={styles.emptySubtitle}>点击下方按钮创建第一个模板</Text>
            </View>
          }
        />

        {/* 新建按钮 */}
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.fabBg}>
            <Feather name="plus" size={28} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* 创建模板Modal */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView 
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>新建模板</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="请输入模板名称"
                placeholderTextColor="#B2BEC3"
                value={newTemplateName}
                onChangeText={setNewTemplateName}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => {
                    setNewTemplateName('');
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.cancelBtnText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.confirmBtn]}
                  onPress={handleCreateTemplate}
                  disabled={!newTemplateName.trim() || creating}
                >
                  <Text style={styles.confirmBtnText}>{creating ? '创建中...' : '创建'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* 删除确认Modal */}
        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>删除模板</Text>
              <Text style={styles.deleteMessage}>
                确定要删除模板《{deletingTemplate?.name}》吗？{'\n'}此操作不可恢复。
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => {
                    setDeletingTemplate(null);
                    setDeleteModalVisible(false);
                  }}
                >
                  <Text style={styles.cancelBtnText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.deleteConfirmBtn]}
                  onPress={handleDeleteTemplate}
                  disabled={deleting}
                >
                  <Text style={styles.deleteBtnText}>{deleting ? '删除中...' : '删除'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F3',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F3',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statInfo: {
    marginLeft: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D3436',
  },
  statLabel: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 2,
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  cardOuter: {
    marginBottom: 12,
  },
  cardLink: {
    // Link wrapper styles
  },
  deleteButton: {
    padding: 8,
    marginRight: 8,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(108,99,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
  },
  cardDescription: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#636E72',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  updateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  updateText: {
    fontSize: 11,
    color: '#B2BEC3',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#636E72',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#B2BEC3',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    zIndex: 10,
  },
  fabBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2D3436',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F5F5F5',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
  },
  confirmBtn: {
    backgroundColor: '#6C63FF',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteConfirmBtn: {
    backgroundColor: '#E74C3C',
  },
  deleteBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteMessage: {
    fontSize: 15,
    color: '#636E72',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
});
