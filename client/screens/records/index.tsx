import { getApiBaseUrl } from '@/utils/api';
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, RefreshControl, Image } from 'react-native';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// 获取图片完整URL
const getImageUrl = (photoPath: string): string => {
  if (!photoPath) return '';
  // 如果是完整URL直接返回
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
    return photoPath;
  }
  // 如果是服务器路径，拼接服务器地址
  if (photoPath.startsWith('/uploads/')) {
    return `https://6458c7a8-0b18-46c1-a294-8cd82523b342.dev.coze.site${photoPath}`;
  }
  // 本地路径直接返回
  if (photoPath.startsWith('file://') || photoPath.startsWith('content://')) {
    return photoPath;
  }
  return photoPath;
};

interface InspectionReport {
  id: number;
  supplier: string;
  product: string;
  batchNumber: string;
  date: string;
  inspector: string;
  status: 'passed' | 'failed' | 'partial';
  passRate: number;
  totalItems: number;
  passedItems: number;
  failedItems: number;
  notes?: string;
  photos?: string[]; // 照片列表
}

interface FilterButtonProps {
  label: string;
  value: 'all' | 'passed' | 'failed';
  count: number;
  filterStatus: 'all' | 'passed' | 'failed';
  onPress: (value: 'all' | 'passed' | 'failed') => void;
}

function FilterButton({ label, value, count, filterStatus, onPress }: FilterButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.filterButton, filterStatus === value && styles.filterButtonActive]}
      onPress={() => onPress(value)}
    >
      <Text style={[styles.filterButtonText, filterStatus === value && styles.filterButtonTextActive]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );
}

export default function RecordsScreen() {
  const router = useSafeRouter();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<InspectionReport[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<InspectionReport[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed'>('all');

  // 在 fetchRecords 之前定义 applyFilters
  const applyFilters = (data: InspectionReport[], query: string, status: 'all' | 'passed' | 'failed') => {
    let filtered = data;
    
    // 搜索过滤
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(item => 
        item.supplier.toLowerCase().includes(lowerQuery) ||
        item.product.toLowerCase().includes(lowerQuery) ||
        item.batchNumber.toLowerCase().includes(lowerQuery) ||
        item.inspector.toLowerCase().includes(lowerQuery)
      );
    }
    
    // 状态过滤
    if (status !== 'all') {
      filtered = filtered.filter(item => item.status === status);
    }
    
    setFilteredRecords(filtered);
  };

  const fetchRecords = useCallback(async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/v1/inspections?status=completed`);
      if (response.ok) {
        const result = await response.json();
        const list = Array.isArray(result) ? result : (result.data || []);
        const filtered = list.filter((item: any) => item.supplier_name || item.product);
        const mapped: InspectionReport[] = filtered.map((item: any) => {
          // 使用 overall_result 字段判断状态
          const overallResult = item.overall_result || item.result;
          const failedItems = item.failed_items || 0;
          const totalItems = item.total_items || 0;
          const passedItems = totalItems - failedItems;
          const passRate = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;
          
          let status: 'passed' | 'failed' | 'partial' = 'partial';
          if (overallResult === 'pass') {
            status = 'passed';
          } else if (overallResult === 'fail') {
            status = 'failed';
          } else if (totalItems > 0) {
            if (failedItems === 0) status = 'passed';
            else if (passRate >= 80) status = 'partial';
            else status = 'failed';
          }
          
          return {
            id: parseInt(item.id),
            supplier: item.supplier_name || item.supplier || '',
            product: item.product_name || item.product || '',
            batchNumber: item.batch_number || item.order_number || '',
            date: item.completed_date || item.inspection_date || item.completed_at || item.created_at || '',
            inspector: item.inspector_name || item.inspector || '',
            status,
            passRate,
            totalItems,
            passedItems,
            failedItems,
            notes: item.notes || item.submit_notes || '',
            photos: item.photos || [], // 保存照片列表
          };
        });
        setRecords(mapped);
        applyFilters(mapped, searchQuery, filterStatus);
      }
    } catch (error) {
      console.error('Failed to fetch records:', error);
      // 使用模拟数据
      const mockData: InspectionReport[] = [
        { id: 1, supplier: '深圳华强电子', product: '智能手表 PCB板', batchNumber: 'PO-2024-001', date: '2024-01-15', inspector: '张三', status: 'passed', passRate: 98, totalItems: 50, passedItems: 49, failedItems: 1, notes: '轻微外观瑕疵' },
        { id: 2, supplier: '东莞智造工厂', product: '蓝牙耳机外壳', batchNumber: 'PO-2024-002', date: '2024-01-14', inspector: '李四', status: 'passed', passRate: 100, totalItems: 30, passedItems: 30, failedItems: 0 },
        { id: 3, supplier: '广州精品制造', product: '无线充电器', batchNumber: 'PO-2024-003', date: '2024-01-13', inspector: '张三', status: 'failed', passRate: 65, totalItems: 40, passedItems: 26, failedItems: 14, notes: '多处尺寸偏差' },
        { id: 4, supplier: '杭州数码科技', product: 'Type-C数据线', batchNumber: 'PO-2024-004', date: '2024-01-12', inspector: '王五', status: 'passed', passRate: 95, totalItems: 60, passedItems: 57, failedItems: 3 },
        { id: 5, supplier: '上海精密科技', product: '手机摄像头模组', batchNumber: 'PO-2024-005', date: '2024-01-11', inspector: '李四', status: 'partial', passRate: 82, totalItems: 25, passedItems: 21, failedItems: 4, notes: '部分对焦不准' },
      ];
      setRecords(mockData);
      applyFilters(mockData, searchQuery, filterStatus);
    }
  }, [filterStatus, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      fetchRecords();
    }, [fetchRecords])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRecords();
    setRefreshing(false);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    applyFilters(records, text, filterStatus);
  };

  const handleStatusFilter = (status: 'all' | 'passed' | 'failed') => {
    setFilterStatus(status);
    applyFilters(records, searchQuery, status);
  };

  const handleRecordPress = (record: InspectionReport) => {
    router.push(`/inspections/${record.id}`);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'passed':
        return { label: '合格/Pass', labelEn: 'Pass', color: '#00B894', bg: 'rgba(0,184,148,0.15)', icon: 'check-circle' };
      case 'failed':
        return { label: '不合格/Fail', labelEn: 'Fail', color: '#E74C3C', bg: 'rgba(231,76,60,0.15)', icon: 'x-circle' };
      default:
        return { label: '部分合格/Partial', labelEn: 'Partial', color: '#FDCB6E', bg: 'rgba(253,203,110,0.15)', icon: 'alert-circle' };
    }
  };

  const renderRecord = ({ item }: { item: InspectionReport }) => {
    const statusConfig = getStatusConfig(item.status);
    // 获取前3张照片用于预览
    const previewPhotos = (item.photos || []).slice(0, 3);
    const photoCount = (item.photos || []).length;
    
    return (
      <TouchableOpacity 
        style={styles.cardOuter} 
        onPress={() => handleRecordPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={styles.supplierName}>{item.supplier}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Feather name={statusConfig.icon as any} size={12} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
          </View>
        
          <View style={styles.cardBody}>
            <Text style={styles.productName}>{item.product}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Feather name="hash" size={14} color="#636E72" />
                <Text style={styles.metaText}>{item.batchNumber}</Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="calendar" size={14} color="#636E72" />
                <Text style={styles.metaText}>{item.date}</Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="user" size={14} color="#636E72" />
                <Text style={styles.metaText}>{item.inspector}</Text>
              </View>
            </View>
          </View>
          
          {/* 照片预览 */}
          {photoCount > 0 && (
            <View style={styles.photoPreviewContainer}>
              <View style={styles.photoPreviewRow}>
                {previewPhotos.map((photo, index) => (
                  <Image
                    key={index}
                    source={{ uri: getImageUrl(photo) }}
                    style={styles.photoThumbnail}
                    resizeMode="cover"
                  />
                ))}
                {photoCount > 3 && (
                  <View style={styles.morePhotosBadge}>
                    <Text style={styles.morePhotosText}>+{photoCount - 3}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.photoCountText}>{photoCount} 张照片 / {photoCount} photos</Text>
            </View>
          )}
        
          <View style={styles.cardStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.passRate}%</Text>
              <Text style={styles.statLabel}>合格率/Pass</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#00B894' }]}>{item.passedItems}</Text>
              <Text style={styles.statLabel}>合格项/Pass</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#E74C3C' }]}>{item.failedItems}</Text>
              <Text style={styles.statLabel}>不合格项/Fail</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.totalItems}</Text>
              <Text style={styles.statLabel}>总项数/Total</Text>
            </View>
          </View>
        
          {item.notes && (
            <View style={styles.notesContainer}>
              <Feather name="message-square" size={12} color="#636E72" />
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          )}
        
          <View style={styles.cardFooter}>
            <Text style={styles.footerText}>点击查看验货报告详情 / Click to view details</Text>
            <Feather name="chevron-right" size={18} color="#B2BEC3" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* 自定义Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>验货记录 / Records</Text>
          <View style={styles.headerRight} />
        </View>

        {/* 搜索框 */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Feather name="search" size={18} color="#B2BEC3" />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索供应商、产品、批次号、验货员... / Search supplier, product..."
              placeholderTextColor="#B2BEC3"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Feather name="x" size={18} color="#B2BEC3" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 状态筛选 */}
        <View style={styles.filterContainer}>
          <FilterButton label="全部/All" value="all" count={records.length} filterStatus={filterStatus} onPress={handleStatusFilter} />
          <FilterButton label="合格/Pass" value="passed" count={records.filter(r => r.status === 'passed').length} filterStatus={filterStatus} onPress={handleStatusFilter} />
          <FilterButton label="不合格/Fail" value="failed" count={records.filter(r => r.status === 'failed').length} filterStatus={filterStatus} onPress={handleStatusFilter} />
        </View>

        {/* 统计概览 */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{records.length}</Text>
            <Text style={styles.summaryLabel}>报告总数/Total</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#00B894' }]}>
              {records.filter(r => r.status === 'passed').length}
            </Text>
            <Text style={styles.summaryLabel}>合格/Pass</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#E74C3C' }]}>
              {records.filter(r => r.status === 'failed').length}
            </Text>
            <Text style={styles.summaryLabel}>不合格/Fail</Text>
          </View>
        </View>

        {/* 报告列表 */}
        <FlatList
          data={filteredRecords}
          renderItem={renderRecord}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6C63FF']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={48} color="#B2BEC3" />
              <Text style={styles.emptyText}>暂无验货报告 / No Records</Text>
              <Text style={styles.emptySubtext}>提交的验货报告将显示在这里 / Submitted reports will appear here</Text>
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
    backgroundColor: '#F0F2F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingTop: 48,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#2D3436',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#6C63FF',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#636E72',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3436',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  cardOuter: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardInner: {
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
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    marginBottom: 12,
  },
  // 照片预览样式
  photoPreviewContainer: {
    marginBottom: 12,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  photoThumbnail: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
  },
  morePhotosBadge: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePhotosText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  photoCountText: {
    fontSize: 12,
    color: '#636E72',
  },
  productName: {
    fontSize: 15,
    color: '#636E72',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#636E72',
  },
  cardStats: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
  },
  statLabel: {
    fontSize: 11,
    color: '#636E72',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    color: '#636E72',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  footerText: {
    fontSize: 13,
    color: '#B2BEC3',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#B2BEC3',
    marginTop: 8,
  },
});
