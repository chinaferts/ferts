import { useState, useCallback, use } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';

interface ChecklistCategory {
  id: number;
  name: string;
  items: string[];
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

export default function ChecklistDetailScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useSafeRouter();
  const [template, setTemplate] = useState<ChecklistDetail | null>(null);

  const fetchTemplate = async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/checklists/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTemplate(data);
      }
    } catch (error) {
      console.error('Failed to fetch template:', error);
      // 使用模拟数据
      setTemplate({
        id: Number(id),
        name: '电子产品通用模板',
        description: '适用于手机、电脑等电子产品的验货检查',
        categories: [
          { id: 1, name: '基本检查', items: ['外观检查', '尺寸测量', '功能测试', '标签检查'] },
          { id: 2, name: '包装检查', items: ['包装完整性', '说明书检查', '配件清单'] },
          { id: 3, name: '特殊测试', items: ['跌落测试', '老化测试', '防水测试'] },
        ],
        usageCount: 48,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-15',
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTemplate();
    }, [id])
  );

  if (!template) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* 头部信息 */}
        <View style={styles.headerCard}>
          <View style={styles.headerIcon}>
            <Feather name="list" size={32} color="#6C63FF" />
          </View>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateDescription}>{template.description}</Text>
          
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
        </View>

        {/* 检查项列表 */}
        {template.categories.map(category => (
          <View key={category.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{category.name}</Text>
            {category.items.map((item, idx) => (
              <View key={idx} style={styles.checklistItem}>
                <View style={styles.itemNumber}>
                  <Text style={styles.itemNumberText}>{idx + 1}</Text>
                </View>
                <Text style={styles.itemName}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* 操作按钮 */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.editButton} onPress={() => Alert.alert('提示', '编辑功能开发中')}>
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
        </View>
      </ScrollView>
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
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: '#636E72',
    marginLeft: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F3',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
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
    fontWeight: '700',
    color: '#6C63FF',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108,99,255,0.15)',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C63FF',
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  useButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
