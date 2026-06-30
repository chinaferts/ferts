import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, RefreshControl } from 'react-native';
import { Screen } from '@/components/Screen';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface Inspection {
  id: number;
  supplier: string;
  product: string;
  status: 'pending' | 'in_progress' | 'completed';
  date: string;
  progress: number;
  aql?: string;
  sampleSize?: number;
  inspector?: string;
  batch_number?: string;
  orderNo?: string;      // 订单号
  productNo?: string;    // 货号
  quantity?: number;     // 数量
}

const STATUS_CONFIG = {
  pending: { label: '待开始', labelEn: 'Pending', color: '#FDCB6E', bg: 'rgba(253,203,110,0.15)' },
  in_progress: { label: '进行中', labelEn: 'In Progress', color: '#0EA5E9', bg: 'rgba(14,165,233,0.15)' },
  completed: { label: '已完成', labelEn: 'Completed', color: '#00B894', bg: 'rgba(0,184,148,0.15)' },
};

function InspectionCard({ item }: { item: Inspection }) {
  const { t } = useLanguage();
  const status = STATUS_CONFIG[item.status];
  const router = useRouter();
  
  const handlePress = () => {
    router.push(`/inspections/${item.id}`);
  };
  
  const showStartButton = item.status === 'pending' || item.status === 'in_progress';
  
  return (
    <TouchableOpacity style={styles.cardOuter} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={styles.supplierName}>{item.supplier}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            <Text style={styles.statusTextEn}>{status.labelEn}</Text>
          </View>
        </View>
      
        <View style={styles.cardBody}>
          <Text style={styles.productName}>{item.product}</Text>
          {/* 订单号、货号、数量 */}
          <View style={styles.orderInfoRow}>
            {item.orderNo && (
              <View style={styles.orderInfoItem}>
                <Text style={styles.orderInfoLabel}>订单号</Text>
                <Text style={styles.orderInfoValue}>{item.orderNo}</Text>
              </View>
            )}
            {item.productNo && (
              <View style={styles.orderInfoItem}>
                <Text style={styles.orderInfoLabel}>货号</Text>
                <Text style={styles.orderInfoValue}>{item.productNo}</Text>
              </View>
            )}
            {item.quantity != null && item.quantity > 0 && (
              <View style={styles.orderInfoItem}>
                <Text style={styles.orderInfoLabel}>数量</Text>
                <Text style={styles.orderInfoValue}>{item.quantity}</Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="calendar" size={14} color="#636E72" />
              <Text style={styles.metaText}>{item.date}</Text>
            </View>
            {item.aql && (
              <View style={styles.metaItem}>
                <Feather name="target" size={14} color="#636E72" />
                <Text style={styles.metaText}>AQL {item.aql}</Text>
              </View>
            )}
            {item.sampleSize && (
              <View style={styles.metaItem}>
                <Feather name="layers" size={14} color="#636E72" />
                <Text style={styles.metaText}>{t('sample')} {item.sampleSize}{t('pcs')}</Text>
              </View>
            )}
          </View>
        </View>
      
        <View style={styles.cardFooter}>
          {showStartButton ? (
            <TouchableOpacity 
              style={styles.startButton}
              onPress={handlePress}
              activeOpacity={0.7}
            >
              <Feather name="play-circle" size={16} color="#FFFFFF" />
              <Text style={styles.startButtonText}>{t('startInspection')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={['#6C63FF', '#896BFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${item.progress}%` }]}
                />
              </View>
              <Text style={styles.progressText}>{item.progress}%</Text>
            </View>
          )}
          <Feather name="chevron-right" size={18} color="#B2BEC3" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function InspectionsListScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [inspections, setInspections] = useState<Inspection[]>([]);

  // 只显示待验货列表，隐藏Tab切换
  const showTabs = false;

  const fetchInspections = useCallback(async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/v1/inspections?status=${activeTab}`);
      if (response.ok) {
        const result = await response.json();
        // API返回格式: { success: true, data: [...] }
        const list = Array.isArray(result) ? result : (result.data || []);
        // 过滤掉没有 supplier_name 的无效数据
        const filtered = list.filter((item: any) => item.supplier_name || item.product);
        // 映射字段：supplier_name -> supplier, product_name -> product
        const mapped = filtered.map((item: any) => ({
          id: parseInt(item.id),
          supplier: item.supplier_name || item.supplier || '',
          product: item.product_name || item.product || '',
          status: item.status || 'pending',
          date: item.inspection_date || item.created_at || new Date().toISOString(),
          progress: item.status === 'completed' ? 100 : item.status === 'in_progress' ? 50 : 0,
          inspector: item.inspector,
          batch_number: item.batch_number,
          orderNo: item.order_no || item.order_number || '',
          productNo: item.product_no || '',
          quantity: item.quantity || item.qty || 0,
        }));
        setInspections(mapped);
      }
    } catch (error) {
      console.error('Failed to fetch inspections:', error);
      // 使用模拟数据
      setInspections([
        { id: 1, supplier: '深圳华强电子', product: '智能手表 PCB板', status: 'in_progress', date: '2024-01-15', progress: 65 },
        { id: 2, supplier: '东莞智造工厂', product: '蓝牙耳机外壳', status: 'pending', date: '2024-01-16', progress: 0 },
        { id: 3, supplier: '广州精品制造', product: '无线充电器', status: 'completed', date: '2024-01-14', progress: 100 },
        { id: 4, supplier: '杭州数码科技', product: 'Type-C数据线', status: 'pending', date: '2024-01-17', progress: 0 },
        { id: 5, supplier: '上海精密科技', product: '手机摄像头模组', status: 'in_progress', date: '2024-01-13', progress: 40 },
        { id: 6, supplier: '北京智造电子', product: '智能手环显示屏', status: 'completed', date: '2024-01-12', progress: 100 },
      ]);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchInspections();
    }, [fetchInspections])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInspections();
    setRefreshing(false);
  };

  const filteredInspections = inspections.filter(item => {
    const matchesSearch = item.supplier.includes(searchQuery) || item.product.includes(searchQuery);
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && item.status === activeTab;
  });

  const tabs = [
    { key: 'all', label: t('all'), labelEn: t('allEn') },
    { key: 'pending', label: t('pending'), labelEn: t('pendingEn') },
    { key: 'in_progress', label: t('inProgress'), labelEn: t('inProgressEn') },
    { key: 'completed', label: t('completed'), labelEn: t('completedEn') },
  ];

  return (
    <Screen>
      {/* 自定义 Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('inspectionTasks')}</Text>
        <Text style={styles.headerTitleEn}>{t('inspectionTasksEn')}</Text>
      </View>
      <View style={styles.container}>
        {/* 搜索栏 */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Feather name="search" size={20} color="#B2BEC3" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchSupplierOrProduct')}
              placeholderTextColor="#B2BEC3"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x" size={18} color="#B2BEC3" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 状态 Tab - 只显示待验货时隐藏 */}
        {showTabs && (
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
                  <Text style={[styles.tabTextEn, activeTab === tab.key && styles.activeTabTextEn]}>
                    {tab.labelEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* 列表 */}
        <FlatList
          data={filteredInspections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <InspectionCard item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="inbox" size={64} color="#B2BEC3" />
              <Text style={styles.emptyTitle}>{t('noInspectionTasks')}</Text>
              <Text style={styles.emptySubtitle}>{t('clickBelowToCreate')}</Text>
            </View>
          }
        />

        {/* 新建按钮 - 仅管理员可见 */}
        {isAdmin && (
          <Link href="/inspections/new" asChild>
            <TouchableOpacity style={styles.fab}>
              <LinearGradient
                colors={['#6C63FF', '#896BFF']}
                style={styles.fabGradient}
              >
                <Feather name="plus" size={28} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </Link>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerTitleEn: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: '#F0F0F3',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#2D3436',
    marginLeft: 10,
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
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636E72',
  },
  tabTextEn: {
    fontSize: 10,
    fontWeight: '400',
    color: '#636E72',
    marginTop: 1,
  },
  activeTabText: {
    color: '#6C63FF',
  },
  activeTabTextEn: {
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
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextEn: {
    fontSize: 9,
    fontWeight: '400',
  },
  cardBody: {
    marginBottom: 12,
  },
  productName: {
    fontSize: 14,
    color: '#636E72',
    marginBottom: 6,
  },
  // 订单信息行样式
  orderInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F5F5F8',
    borderRadius: 8,
  },
  orderInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderInfoLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginRight: 4,
  },
  orderInfoValue: {
    fontSize: 12,
    color: '#2D3436',
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
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
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E8E8EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
    marginLeft: 10,
    width: 36,
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  startButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
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
