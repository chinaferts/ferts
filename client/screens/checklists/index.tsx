import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

  const renderTemplateCard = ({ item }: { item: ChecklistTemplate }) => (
    <Link href={`/checklists/${item.id}`} asChild>
      <TouchableOpacity style={styles.cardOuter}>
        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Feather name="list" size={22} color="#6C63FF" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
            </View>
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
      </TouchableOpacity>
    </Link>
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
          onPress={() => Alert.alert('提示', '新建模板功能开发中')}
        >
          <LinearGradient
            colors={['#6C63FF', '#896BFF']}
            style={styles.fabGradient}
          >
            <Feather name="plus" size={28} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
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
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  cardOuter: {
    marginBottom: 12,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    borderRadius: 20,
  },
  cardInner: {
    backgroundColor: '#F0F0F3',
    borderRadius: 20,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(108,99,255,0.12)',
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
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#636E72',
    marginLeft: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8EB',
  },
  updateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  updateText: {
    fontSize: 12,
    color: '#B2BEC3',
    marginLeft: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderRadius: 8,
  },
  editText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
