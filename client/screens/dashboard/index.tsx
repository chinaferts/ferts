import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Dimensions, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';

const { width } = Dimensions.get('window');

// 统计数据卡片
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ title, value, subtitle, icon, color, trend }: StatCardProps) {
  return (
    <View style={styles.statCardOuter}>
      <View style={styles.statCardInner}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <Feather name={icon} size={22} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
        <View style={styles.trendContainer}>
          {trend && (
            <Feather 
              name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'minus'} 
              size={14} 
              color={trend === 'up' ? '#00B894' : trend === 'down' ? '#FF6B6B' : '#636E72'} 
            />
          )}
          <Text style={styles.statSubtitle}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

// 快捷操作卡片
interface QuickActionProps {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  href: string;
}

function QuickAction({ title, icon, color, href }: QuickActionProps) {
  return (
    <Link href={href} asChild>
      <TouchableOpacity style={styles.quickAction}>
        <View style={[styles.quickActionIcon, { backgroundColor: `${color}15` }]}>
          <Feather name={icon} size={24} color={color} />
        </View>
        <Text style={styles.quickActionText}>{title}</Text>
      </TouchableOpacity>
    </Link>
  );
}

// 最近验货任务卡片
interface RecentInspectionProps {
  id: number;
  supplier: string;
  product: string;
  status: 'pending' | 'in_progress' | 'completed';
  date: string;
  progress: number;
  onPress?: (id: number) => void;
}

function RecentInspectionCard({ item, onPress }: { item: RecentInspectionProps; onPress?: (id: number) => void }) {
  const statusConfig = {
    pending: { label: '待开始', color: '#FDCB6E', bg: 'rgba(253,203,110,0.15)' },
    in_progress: { label: '进行中', color: '#0EA5E9', bg: 'rgba(14,165,233,0.15)' },
    completed: { label: '已完成', color: '#00B894', bg: 'rgba(0,184,148,0.15)' },
  };
  
  const status = statusConfig[item.status];
  
  return (
    <TouchableOpacity 
      style={styles.inspectionCardOuter} 
      onPress={() => onPress ? onPress(item.id) : Alert.alert('提示', '查看验货详情功能开发中')}
    >
      <View style={styles.inspectionCardInner}>
        <View style={styles.inspectionHeader}>
          <View style={styles.inspectionInfo}>
            <Text style={styles.supplierName}>{item.supplier}</Text>
            <Text style={styles.productName}>{item.product}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
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
        <View style={styles.inspectionFooter}>
          <View style={styles.dateContainer}>
            <Feather name="calendar" size={14} color="#636E72" />
            <Text style={styles.dateText}>{item.date}</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#B2BEC3" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  });
  const [recentInspections, setRecentInspections] = useState<RecentInspectionProps[]>([]);

  const handleInspectionPress = (id: number) => {
    router.push(`/inspections/${id}`);
  };

  const fetchDashboardData = async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/inspections/dashboard`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        setStats(data.stats || { total: data.total || 0, pending: data.pending || 0, inProgress: data.inProgress || 0, completed: data.completed || 0 });
        const recentList = data.recentInspections || data.recent || [];
        setRecentInspections(recentList.map((item: any) => ({
          id: parseInt(item.id),
          supplier: item.supplier_name || item.supplier || '',
          product: item.product_name || item.product || '',
          status: item.status || 'pending',
          date: item.inspection_date || item.created_at || '',
          progress: item.status === 'completed' ? 100 : item.status === 'in_progress' ? 50 : 0,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // 使用模拟数据
      setStats({ total: 24, pending: 8, inProgress: 6, completed: 10 });
      setRecentInspections([
        { id: 1, supplier: '深圳华强电子', product: '智能手表 PCB板', status: 'in_progress', date: '2024-01-15', progress: 65 },
        { id: 2, supplier: '东莞智造工厂', product: '蓝牙耳机外壳', status: 'pending', date: '2024-01-16', progress: 0 },
        { id: 3, supplier: '广州精品制造', product: '无线充电器', status: 'completed', date: '2024-01-14', progress: 100 },
        { id: 4, supplier: '杭州数码科技', product: 'Type-C数据线', status: 'pending', date: '2024-01-17', progress: 0 },
      ]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const fetchDashboardDataInner = async () => {
        try {
          const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
          const response = await fetch(`${baseUrl}/api/v1/inspections/dashboard`);
          if (response.ok) {
            const result = await response.json();
            const data = result.data || result;
            setStats(data.stats || { total: data.total || 0, pending: data.pending || 0, inProgress: data.inProgress || 0, completed: data.completed || 0 });
            const recentList = data.recentInspections || data.recent || [];
            setRecentInspections(recentList.map((item: any) => ({
              id: parseInt(item.id),
              supplier: item.supplier_name || item.supplier || '',
              product: item.product_name || item.product || '',
              status: item.status || 'pending',
              date: item.inspection_date || item.created_at || '',
              progress: item.status === 'completed' ? 100 : item.status === 'in_progress' ? 50 : 0,
            })));
          }
        } catch (error) {
          console.error('Failed to fetch dashboard data:', error);
          // 使用模拟数据
          setStats({ total: 24, pending: 8, inProgress: 6, completed: 10 });
          setRecentInspections([
            { id: 1, supplier: '深圳华强电子', product: '智能手表 PCB板', status: 'in_progress', date: '2024-01-15', progress: 65 },
            { id: 2, supplier: '东莞智造工厂', product: '蓝牙耳机外壳', status: 'pending', date: '2024-01-16', progress: 0 },
            { id: 3, supplier: '广州精品制造', product: '无线充电器', status: 'completed', date: '2024-01-14', progress: 100 },
            { id: 4, supplier: '杭州数码科技', product: 'Type-C数据线', status: 'pending', date: '2024-01-17', progress: 0 },
          ]);
        }
      };
      fetchDashboardDataInner();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  return (
    <Screen>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
        }
      >
        {/* 头部欢迎 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>验货助手</Text>
            <Text style={styles.subGreeting}>Quality Inspector</Text>
          </View>
          <View style={styles.avatarContainer}>
            <Feather name="user" size={24} color="#FFFFFF" />
          </View>
        </View>

        {/* 统计卡片 */}
        <View style={styles.statsRow}>
          <StatCard
            title="总任务"
            value={stats.total}
            subtitle="本月验货"
            icon="clipboard"
            color="#6C63FF"
            trend="up"
          />
          <StatCard
            title="进行中"
            value={stats.inProgress}
            subtitle="今日完成"
            icon="activity"
            color="#0EA5E9"
            trend="neutral"
          />
          <StatCard
            title="已完成"
            value={stats.completed}
            subtitle="通过率 98%"
            icon="check-circle"
            color="#00B894"
            trend="up"
          />
          <StatCard
            title="待处理"
            value={stats.pending}
            subtitle="需尽快处理"
            icon="clock"
            color="#FDCB6E"
            trend="down"
          />
        </View>

        {/* 快捷操作 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快捷操作</Text>
          <View style={styles.quickActionsGrid}>
            <QuickAction title="新建验货" icon="plus-circle" color="#6C63FF" href="/inspections/new" />
            <QuickAction title="扫码识别" icon="maximize" color="#0EA5E9" href="/inspections/scan" />
            <QuickAction title="清单模板" icon="list" color="#00B894" href="/checklists" />
            <QuickAction title="缺陷记录" icon="alert-triangle" color="#FF6B6B" href="/defects" />
          </View>
        </View>

        {/* 待验货列表 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>待验货列表</Text>
            <Link href="/inspections" asChild>
              <TouchableOpacity style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>查看全部</Text>
                <Feather name="chevron-right" size={16} color="#6C63FF" />
              </TouchableOpacity>
            </Link>
          </View>
          {recentInspections.filter(item => item.status === 'pending' || item.status === 'in_progress').length > 0 ? (
            recentInspections.filter(item => item.status === 'pending' || item.status === 'in_progress').map((item) => (
              <RecentInspectionCard key={item.id} item={item} onPress={handleInspectionPress} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color="#B2BEC3" />
              <Text style={styles.emptyText}>暂无待验货任务</Text>
            </View>
          )}
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2D3436',
  },
  subGreeting: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 2,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCardOuter: {
    width: '23%',
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    borderRadius: 16,
  },
  statCardInner: {
    backgroundColor: '#F0F0F3',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6C63FF',
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D3436',
    marginTop: 2,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statSubtitle: {
    fontSize: 10,
    color: '#636E72',
    marginLeft: 4,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 12,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C63FF',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickAction: {
    width: '23%',
    backgroundColor: '#F0F0F3',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
  },
  inspectionCardOuter: {
    marginBottom: 12,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    borderRadius: 20,
  },
  inspectionCardInner: {
    backgroundColor: '#F0F0F3',
    borderRadius: 20,
    padding: 16,
  },
  inspectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  inspectionInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
  },
  productName: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 2,
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E8E8EB',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C63FF',
    width: 40,
  },
  inspectionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#636E72',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#B2BEC3',
    marginTop: 12,
  },
});
