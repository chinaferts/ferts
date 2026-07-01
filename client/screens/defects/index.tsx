import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Dimensions } from 'react-native';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface DefectRecord {
  id: number;
  supplier: string;
  product: string;
  inspectionDate: string;
  defectName: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  status: 'open' | 'resolved';
}

const { width } = Dimensions.get('window');

const SEVERITY_CONFIG = {
  critical: { label: '严重', color: '#FF6B6B', bg: 'rgba(255,107,107,0.15)' },
  major: { label: '主要', color: '#FDCB6E', bg: 'rgba(253,203,110,0.15)' },
  minor: { label: '次要', color: '#0EA5E9', bg: 'rgba(14,165,233,0.15)' },
};

export default function DefectsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'resolved'>('all');
  const [defects, setDefects] = useState<DefectRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      const fetchDefects = async () => {
        try {
          const baseUrl = '';
          const response = await fetch(`${baseUrl}/api/v1/defects?status=${activeTab}`);
          if (response.ok) {
            const result = await response.json();
            const list = result.data || result || [];
            setDefects(list.map((d: any) => ({
              id: d.id,
              supplier: d.supplier_name || d.supplier || '',
              product: d.product_name || d.product || '',
              inspectionDate: d.inspection_date || d.inspectionDate || '',
              defectName: d.defect_name || d.defectName || '',
              severity: d.severity || 'minor',
              description: d.description || '',
              status: d.status || 'open',
            })));
          }
        } catch (error) {
          console.error('Failed to fetch defects:', error);
        }
      };
      fetchDefects();
    }, [activeTab])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const baseUrl = '';
      const response = await fetch(`${baseUrl}/api/v1/defects?status=${activeTab}`);
      if (response.ok) {
        const result = await response.json();
        const list = result.data || result || [];
        setDefects(list.map((d: any) => ({
          id: d.id,
          supplier: d.supplier_name || d.supplier || '',
          product: d.product_name || d.product || '',
          inspectionDate: d.inspection_date || d.inspectionDate || '',
          defectName: d.defect_name || d.defectName || '',
          severity: d.severity || 'minor',
          description: d.description || '',
          status: d.status || 'open',
        })));
      }
    } catch (error) {
      console.error('Failed to fetch defects:', error);
    }
    setRefreshing(false);
  };

  const filteredDefects = defects.filter(d => {
    if (activeTab === 'all') return true;
    return d.status === activeTab;
  });

  const stats = {
    total: defects.length,
    critical: defects.filter(d => d.severity === 'critical' && d.status === 'open').length,
    open: defects.filter(d => d.status === 'open').length,
    resolved: defects.filter(d => d.status === 'resolved').length,
  };

  const tabs = [
    { key: 'all', label: '全部', count: stats.total },
    { key: 'open', label: '待处理', count: stats.open },
    { key: 'resolved', label: '已解决', count: stats.resolved },
  ];

  const renderDefectCard = ({ item }: { item: DefectRecord }) => {
    const severity = SEVERITY_CONFIG[item.severity];
    
    return (
      <View style={styles.cardOuter}>
        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <View style={[styles.severityBadge, { backgroundColor: severity.bg }]}>
              <Text style={[styles.severityText, { color: severity.color }]}>{severity.label}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: item.status === 'open' ? 'rgba(255,107,107,0.15)' : 'rgba(0,184,148,0.15)' }]}>
              <Text style={[styles.statusText, { color: item.status === 'open' ? '#FF6B6B' : '#00B894' }]}>
                {item.status === 'open' ? '待处理' : '已解决'}
              </Text>
            </View>
          </View>

          <Text style={styles.defectName}>{item.defectName}</Text>
          <Text style={styles.defectDescription} numberOfLines={2}>{item.description}</Text>

          <View style={styles.divider} />

          <View style={styles.cardMeta}>
            <View style={styles.metaLeft}>
              <View style={styles.metaItem}>
                <Feather name="home" size={12} color="#636E72" />
                <Text style={styles.metaText}>{item.supplier}</Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="box" size={12} color="#636E72" />
                <Text style={styles.metaText}>{item.product}</Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <Feather name="calendar" size={12} color="#636E72" />
              <Text style={styles.metaText}>{item.inspectionDate}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* 统计卡片 */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: 'rgba(255,107,107,0.12)' }]}>
              <Text style={[styles.statValue, { color: '#FF6B6B' }]}>{stats.critical}</Text>
              <Text style={styles.statLabel}>严重缺陷</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: 'rgba(253,203,110,0.12)' }]}>
              <Text style={[styles.statValue, { color: '#FDCB6E' }]}>{stats.open}</Text>
              <Text style={styles.statLabel}>待处理</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: 'rgba(0,184,148,0.12)' }]}>
              <Text style={[styles.statValue, { color: '#00B894' }]}>{stats.resolved}</Text>
              <Text style={styles.statLabel}>已解决</Text>
            </View>
          </View>
        </View>

        {/* Tab切换 */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                onPress={() => setActiveTab(tab.key as typeof activeTab)}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 缺陷列表 */}
        <FlatList
          data={filteredDefects}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderDefectCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={64} color="#00B894" />
              <Text style={styles.emptyTitle}>暂无缺陷记录</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'all' ? '还没有任何缺陷记录' : activeTab === 'open' ? '所有缺陷都已处理完毕' : '暂无已解决的缺陷'}
              </Text>
            </View>
          }
        />
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    color: '#636E72',
    marginTop: 2,
  },
  tabsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E8E8EB',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636E72',
  },
  activeTabText: {
    color: '#6C63FF',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E8E8EB',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(108,99,255,0.15)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#636E72',
  },
  tabBadgeTextActive: {
    color: '#6C63FF',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  defectName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 4,
  },
  defectDescription: {
    fontSize: 13,
    color: '#636E72',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E8EB',
    marginVertical: 12,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLeft: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    color: '#636E72',
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
    textAlign: 'center',
  },
});
