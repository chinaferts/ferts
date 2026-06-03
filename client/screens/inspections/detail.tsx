import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal, Image, Platform, TouchableWithoutFeedback } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Screen } from '@/components/Screen';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { createFormDataFile } from '@/utils';
import CustomCamera from '@/components/CustomCamera';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

interface ChecklistItem {
  id: number;
  record_id: number;
  name: string;
  description?: string;
  category: string;
  status: 'pass' | 'fail' | 'unchecked';
  notes?: string;
  photos?: string[];
  barcodeCodes?: string[];  // 条码扫描记录
  barcodeType?: 'box' | 'inner' | 'color'; // 条码类型：外箱、内箱/内袋、彩盒/彩卡
}

interface Defect {
  id: number;
  title: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  photo_urls?: string[];
}

interface InspectionDetail {
  id: number;
  supplier_name: string;
  product_name: string;
  status: 'pending' | 'in_progress' | 'completed';
  scheduled_date: string;
  checklist_id: number;
  checkedCount: number;
  defectCount: number;
  batch_number?: string;
  style_number?: string;
  color?: string;
  size?: string;
  quantity?: string | number;
  sample_size?: string | number;
  aql?: string;
  inspection_date?: string;
  inspector?: string;
  notes?: string;
  created_at?: string;
  checklist_items: ChecklistItem[];
  defects: Defect[];
}

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useSafeRouter();
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [defectModalVisible, setDefectModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null);
  const [defectForm, setDefectForm] = useState({
    severity: 'minor' as 'critical' | 'major' | 'minor',
    description: '',
  });
  const [defectPhotos, setDefectPhotos] = useState<string[]>([]);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedPhotoItem, setSelectedPhotoItem] = useState<ChecklistItem | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(-1);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  // 拍照临时状态 - 用于新流程：先拍照到预览区，完成后再保存
  const [tempPhotoTarget, setTempPhotoTarget] = useState<ChecklistItem | null>(null);
  const [tempPhotos, setTempPhotos] = useState<string[]>([]);
  // 相机相关状态
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraPhotoTarget, setCameraPhotoTarget] = useState<ChecklistItem | null>(null);
  // 编辑照片相关状态
  const [editingPhoto, setEditingPhoto] = useState<{ uri: string; recordId: number; index: number } | null>(null);
  const [editPhotoModalVisible, setEditPhotoModalVisible] = useState(false);
  // 条码扫码相关状态
  const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false);
  const [barcodeScanTarget, setBarcodeScanTarget] = useState<ChecklistItem | null>(null);
  const [barcodePermission, requestBarcodePermission] = useCameraPermissions();
  const barcodeCameraRef = useRef<CameraView>(null);
  
  // 问题描述框状态 (每个问题包含文本、照片和严重程度)
  const [issues, setIssues] = useState<Array<{ text: string; photos: string[]; severity: string }>>([{ text: '', photos: [], severity: '' }]);
  // 条码扫描项状态 (存储新增的条码扫描项)
  const [extraBarcodeItems, setExtraBarcodeItems] = useState<ChecklistItem[]>([]);
  // 合并后的条码扫描列表（原始项 + 新增项）
  const barcodeItems = [
    ...(inspection?.checklist_items.filter(item => item.category === '条码') || []),
    ...extraBarcodeItems
  ];
  // 严重程度选项
  const severityOptions = [
    { label: '致命缺陷', value: 'critical', color: '#DC3545', bgColor: 'rgba(220,53,69,0.1)' },
    { label: '严重缺陷', value: 'serious', color: '#FD7E14', bgColor: 'rgba(253,126,20,0.1)' },
    { label: '轻微缺陷', value: 'minor', color: '#FFC107', bgColor: 'rgba(255,193,7,0.15)' },
  ];
  // 缺陷统计状态
  const [defectStats, setDefectStats] = useState({
    critical: 0,    // 致命缺陷
    serious: 0,     // 严重缺陷
    minor: 0,       // 轻微缺陷
  });
  // 当前拍照的问题索引
  const [cameraIssueIndex, setCameraIssueIndex] = useState<number | null>(null);
  const [issueCameraVisible, setIssueCameraVisible] = useState(false);
  // 严重程度选择弹窗状态
  const [severityModalVisible, setSeverityModalVisible] = useState(false);
  const [selectedIssueIndex, setSelectedIssueIndex] = useState<number | null>(null);
  // 条码类型选择弹窗状态
  const [barcodeTypeModalVisible, setBarcodeTypeModalVisible] = useState(false);
  const [selectedBarcodeIndex, setSelectedBarcodeIndex] = useState<number | null>(null);
  // 条码类型选项
  const barcodeTypeOptions = [
    { label: '外箱条码', value: 'box', color: '#6C63FF', bgColor: 'rgba(108,99,255,0.1)' },
    { label: '内箱/内袋条码', value: 'inner', color: '#00B894', bgColor: 'rgba(0,184,148,0.1)' },
    { label: '彩盒/彩卡条码', value: 'color', color: '#FDCB6E', bgColor: 'rgba(253,203,110,0.15)' },
  ];
  
  // 问题描述框处理函数
  const handleAddIssue = () => {
    setIssues([...issues, { text: '', photos: [], severity: '' }]);
  };
  
  // 添加条码扫描项
  const handleAddBarcode = () => {
    const newItem: ChecklistItem = {
      id: Date.now(),
      record_id: Date.now(),
      name: '条码扫描',
      description: '扫描条码',
      category: '条码',
      status: 'unchecked',
      photos: [],
      barcodeCodes: [],
      barcodeType: 'box', // 默认外箱条码
    };
    setExtraBarcodeItems([...extraBarcodeItems, newItem]);
  };

  // 更新条码扫描项的类型
  const updateBarcodeItemType = (recordId: number, type: string) => {
    setExtraBarcodeItems(items => items.map(i => 
      i.record_id === recordId ? { ...i, barcodeType: type as 'box' | 'inner' | 'color' } : i
    ));
  };

  // 条码类型选择器函数
  const openBarcodeTypeSelector = (index: number) => {
    setSelectedBarcodeIndex(index);
    setBarcodeTypeModalVisible(true);
  };

  const closeBarcodeTypeSelector = () => {
    setBarcodeTypeModalVisible(false);
    setSelectedBarcodeIndex(null);
  };

  const handleBarcodeTypeChange = (type: string) => {
    if (selectedBarcodeIndex !== null) {
      const item = extraBarcodeItems[selectedBarcodeIndex];
      if (item) {
        updateBarcodeItemType(item.record_id, type);
      }
      closeBarcodeTypeSelector();
    }
  };
  
  const handleSeverityChange = (index: number, severity: string) => {
    const newIssues = [...issues];
    newIssues[index].severity = severity;
    setIssues(newIssues);
    setSeverityModalVisible(false);
    setSelectedIssueIndex(null);
  };
  
  const openSeveritySelector = (index: number) => {
    setSelectedIssueIndex(index);
    setSeverityModalVisible(true);
  };
  
  const closeSeveritySelector = () => {
    setSeverityModalVisible(false);
    setSelectedIssueIndex(null);
  };
  
  const handleRemoveIssue = (index: number) => {
    if (issues.length > 1) {
      setIssues(issues.filter((_, i) => i !== index));
    }
  };
  
  const handleIssueChange = (index: number, text: string) => {
    const newIssues = [...issues];
    newIssues[index].text = text;
    setIssues(newIssues);
  };
  
  // 问题描述拍照函数 - 使用 CustomCamera 组件
  const handleOpenCamera = (index: number) => {
    setCameraIssueIndex(index);
    setIssueCameraVisible(true);
  };
  
  const handleCloseCamera = () => {
    setIssueCameraVisible(false);
    setCameraIssueIndex(null);
  };
  
  // CustomCamera 拍照完成回调
  const handleIssueCameraComplete = (photos: Array<{ uri: string; timestamp: number }>) => {
    if (cameraIssueIndex !== null && photos.length > 0) {
      const newIssues = [...issues];
      const newPhotoUris = photos.map(p => p.uri);
      newIssues[cameraIssueIndex].photos = [...newIssues[cameraIssueIndex].photos, ...newPhotoUris];
      setIssues(newIssues);
    }
    handleCloseCamera();
  };
  
  const handleRemoveIssuePhoto = (issueIndex: number, photoIndex: number) => {
    const newIssues = [...issues];
    newIssues[issueIndex].photos.splice(photoIndex, 1);
    setIssues(newIssues);
  };
  
  // 使用 ref 跟踪 inspection 以避免闭包问题
  const inspectionRef = useRef(inspection);
  useEffect(() => {
    inspectionRef.current = inspection;
  }, [inspection]);

  const fetchInspection = async () => {
    if (!id) return;
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/inspections/${id}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        // 转换 inspection_records 为 checklist_items 格式
        const checklistItems = (data.inspection_records || []).map((record: any, index: number) => ({
          id: parseInt(record.checklist_item_id || record.id || index),
          record_id: parseInt(record.id || index),
          name: record.item_name || record.name || '未命名',
          description: record.item_description || record.description,
          category: record.item_category || record.category || '其他',
          status: record.result || 'unchecked',
          notes: record.notes,
          photos: record.photos || [],
        }));
        
        const checkedCount = checklistItems.filter((i: ChecklistItem) => i.status !== 'unchecked').length;
        const defectCount = checklistItems.filter((i: ChecklistItem) => i.status === 'fail').length;
        
        setInspection({
          ...data,
          checklist_items: checklistItems,
          checkedCount,
          defectCount,
        });
      }
    } catch (error) {
      console.error('Failed to fetch inspection:', error);
      Alert.alert('错误', '获取验货详情失败');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInspection();
    }, [id])
  );

  // 更新检查项状态
  const updateChecklistItem = async (item: ChecklistItem, status: 'pass' | 'fail') => {
    if (!inspection) return;

    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/inspections/${id}/records/${item.record_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: status }),
      });

      if (response.ok) {
        // 更新本地状态 - 使用 record_id 字符串比较确保类型一致
        const targetRecordId = String(item.record_id);
        const updatedItems = inspection.checklist_items.map(i =>
          String(i.record_id) === targetRecordId ? { ...i, status } : i
        );
        const checkedCount = updatedItems.filter(i => i.status !== 'unchecked').length;
        const defectCount = updatedItems.filter(i => i.status === 'fail').length;

        setInspection({
          ...inspection,
          checklist_items: updatedItems,
          checkedCount,
          defectCount,
          status: 'in_progress',
        });
      } else {
        Alert.alert('错误', '更新失败');
      }
    } catch (error) {
      console.error('Failed to update checklist item:', error);
    }
  };

  // 拍照功能 - 打开相机页面
  const takePhoto = (item?: ChecklistItem) => {
    const targetItem = item || selectedItem;
    if (!targetItem) return;
    
    // 设置临时目标
    setTempPhotoTarget(targetItem);
    setTempPhotos([]);
    // 打开相机
    setCameraVisible(true);
  };

  // 完成拍照 - 将临时照片保存到清单项
  const handleCompletePhotos = () => {
    if (!tempPhotoTarget || tempPhotos.length === 0) {
      // 如果没有照片，清除状态
      setTempPhotoTarget(null);
      setTempPhotos([]);
      return;
    }
    
    // 将临时照片保存到对应的清单项
    const targetRecordId = String(tempPhotoTarget.record_id);
    const updatedItems = inspection?.checklist_items.map(i =>
      String(i.record_id) === targetRecordId
        ? { ...i, photos: [...(i.photos || []), ...tempPhotos] }
        : i
    );
    
    // 更新检查状态为已检查
    const updatedItemsWithStatus = updatedItems?.map(i =>
      String(i.record_id) === targetRecordId
        ? { ...i, result: 'pass' }
        : i
    );
    
    setInspection(prev => prev ? { ...prev, checklist_items: updatedItemsWithStatus || [] } : null);
    
    // 清除临时状态
    setTempPhotoTarget(null);
    setTempPhotos([]);
  };

  // 添加缺陷
  const handleAddDefect = async () => {
    if (!selectedItem || !defectForm.description.trim()) {
      Alert.alert('提示', '请填写缺陷描述');
      return;
    }

    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/defects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspection_id: id,
          title: selectedItem.name,
          severity: defectForm.severity,
          description: defectForm.description,
          location_description: `检查项: ${selectedItem.name}`,
          photo_urls: defectPhotos,
        }),
      });

      if (response.ok) {
        // 同时标记该项为不合格
        await updateChecklistItem(selectedItem, 'fail');

        const newDefect: Defect = {
          id: Date.now(),
          title: selectedItem.name,
          severity: defectForm.severity,
          description: defectForm.description,
          photo_urls: defectPhotos,
        };

        setInspection(prev => prev ? {
          ...prev,
          defects: [...prev.defects, newDefect],
          defectCount: prev.defectCount + 1,
        } : null);
      }
    } catch (error) {
      console.error('Failed to add defect:', error);
    }

    setDefectModalVisible(false);
    setDefectForm({ severity: 'minor', description: '' });
    setDefectPhotos([]);
    setSelectedItem(null);
  };

  // 提交验货
  const handleSubmit = async () => {
    if (!inspection) return;

    const uncheckedCount = inspection.checklist_items.filter(i => i.status === 'unchecked').length;
    if (uncheckedCount > 0) {
      Alert.alert('提示', `还有 ${uncheckedCount} 项未检查，请确认是否继续提交？`, [
        { text: '继续检查', style: 'cancel' },
        { text: '确认提交', onPress: doSubmit },
      ]);
    } else {
      doSubmit();
    }
  };

  const doSubmit = async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/inspections/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        Alert.alert('成功', '验货报告已提交', [
          { text: '确定', onPress: () => router.navigate('/inspections') },
        ]);
      } else {
        Alert.alert('错误', '提交失败');
      }
    } catch (error) {
      console.error('Failed to submit:', error);
      Alert.alert('错误', '提交失败');
    }
  };

  // 打开条码扫码
  const openBarcodeScanner = (item: ChecklistItem) => {
    setBarcodeScanTarget(item);
    setBarcodeScannerVisible(true);
  };

  // 处理条码扫描结果
  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (result.data && barcodeScanTarget) {
      // 将扫描到的条码添加到对应检查项
      const targetRecordId = String(barcodeScanTarget.record_id);
      setInspection(prev => {
        if (!prev) return null;
        const updatedItems = prev.checklist_items.map(i =>
          String(i.record_id) === targetRecordId
            ? { ...i, barcodeCodes: [...(i.barcodeCodes || []), result.data] }
            : i
        );
        // 同时更新检查状态为已检查
        const updatedItemsWithStatus = updatedItems.map(i =>
          String(i.record_id) === targetRecordId && i.status === 'unchecked'
            ? { ...i, status: 'pass' as const }
            : i
        );
        const checkedCount = updatedItemsWithStatus.filter(i => i.status !== 'unchecked').length;
        const defectCount = updatedItemsWithStatus.filter(i => i.status === 'fail').length;
        return { ...prev, checklist_items: updatedItemsWithStatus, checkedCount, defectCount };
      });
      Alert.alert('扫码成功', `条码: ${result.data}`);
    }
  };

  // 关闭条码扫码
  const closeBarcodeScanner = () => {
    setBarcodeScannerVisible(false);
    setBarcodeScanTarget(null);
  };

  if (loading || !inspection) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </Screen>
    );
  }

  // 按分类分组
  const categories = [...new Set(inspection.checklist_items.map(item => item.category))];
  const progress = inspection.checklist_items.length > 0
    ? Math.round((inspection.checkedCount / inspection.checklist_items.length) * 100)
    : 0;
  const totalPhotos = inspection.checklist_items.reduce((sum, item) => sum + (item.photos?.length || 0), 0);

  return (
    <Screen>
      {/* 自定义相机页面 - 全屏显示 */}
      {cameraVisible && tempPhotoTarget && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
          <CustomCamera
          visible={cameraVisible}
          onClose={() => setCameraVisible(false)}
          onComplete={async (photos) => {
            // 使用 ref 获取最新的 inspection 避免闭包问题
            const currentInspection = inspectionRef.current;
            if (!currentInspection) return;
            
            const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
            const photoUris = photos.map(p => p.uri);
            const targetRecordId = tempPhotoTarget.record_id;
            
            // 将照片添加到本地状态
            const updatedItems = currentInspection.checklist_items.map(item => {
              if (item.record_id === targetRecordId) {
                return { ...item, photos: [...(item.photos || []), ...photoUris] };
              }
              return item;
            });
            setInspection(prev => prev ? { ...prev, checklist_items: updatedItems } : null);
            
            // 上传照片到服务器
            try {
              for (let i = 0; i < photos.length; i++) {
                const photo = photos[i];
                const filename = photo.uri.split('/').pop() || `photo_${Date.now()}_${i}.jpg`;
                const match = /\.(\w+)$/.exec(filename);
                const mimeType = match ? `image/${match[1]}` : 'image/jpeg';
                
                const fileObj = await createFormDataFile(photo.uri, filename, mimeType);
                
                const formData = new FormData();
                formData.append('record_id', String(targetRecordId));
                formData.append('photo', fileObj as any);
                
                await fetch(`${baseUrl}/api/v1/inspections/${id}/photos`, {
                  method: 'POST',
                  body: formData,
                });
              }
            } catch (error) {
              console.error('上传照片失败:', error);
              // 即使上传失败，也继续关闭相机
            }
            
            setCameraVisible(false);
            setTempPhotoTarget(null);
            setTempPhotos([]);
          }}
        />
        </View>
      )}
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* 头部信息 */}
        <View style={styles.headerCard}>
          {/* 顶部行：供应商和状态 */}
          <View style={styles.headerTopRow}>
            <View style={styles.headerMain}>
              {/* 订单号 */}
              {inspection.batch_number && (
                <Text style={styles.orderNumber}>{inspection.batch_number}</Text>
              )}
              {/* 供应商 */}
              <Text style={styles.supplierName}>{inspection.supplier_name}</Text>
            </View>
            <View style={[styles.statusBadge, {
              backgroundColor: inspection.status === 'completed' ? 'rgba(0,184,148,0.15)' : 'rgba(14,165,233,0.15)'
            }]}>
              <Text style={[styles.statusText, { color: inspection.status === 'completed' ? '#00B894' : '#0EA5E9' }]}>
                {inspection.status === 'pending' ? '待开始' : inspection.status === 'in_progress' ? '进行中' : '已完成'}
              </Text>
            </View>
          </View>

          {/* 基本信息 - 两列布局 */}
          <View style={styles.basicInfoGrid}>
            {/* 产品名称 */}
            <View style={styles.basicInfoItem}>
              <Text style={styles.basicInfoLabel}>产品名称</Text>
              <Text style={styles.basicInfoValue}>{inspection.product_name}</Text>
            </View>
            {/* 货号 */}
            {inspection.style_number && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>货号</Text>
                <Text style={styles.basicInfoValue}>{inspection.style_number}</Text>
              </View>
            )}
            {/* 产品数量 */}
            {inspection.quantity && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>产品数量</Text>
                <Text style={styles.basicInfoValue}>{inspection.quantity}</Text>
              </View>
            )}
            {/* 抽样数量 */}
            {inspection.sample_size && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>抽样数量</Text>
                <Text style={styles.basicInfoValue}>{inspection.sample_size}</Text>
              </View>
            )}
            {/* AQL质量等级 */}
            {inspection.aql && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>AQL质量等级</Text>
                <Text style={styles.basicInfoValue}>{inspection.aql}</Text>
              </View>
            )}
            {/* 验货日期 */}
            {inspection.inspection_date && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>验货日期</Text>
                <Text style={styles.basicInfoValue}>{inspection.inspection_date}</Text>
              </View>
            )}
            {/* 验货员 */}
            {inspection.inspector && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>验货员</Text>
                <Text style={styles.basicInfoValue}>{inspection.inspector}</Text>
              </View>
            )}
            {/* 颜色 */}
            {inspection.color && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>颜色</Text>
                <Text style={styles.basicInfoValue}>{inspection.color}</Text>
              </View>
            )}
            {/* 尺码 */}
            {inspection.size && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>尺码</Text>
                <Text style={styles.basicInfoValue}>{inspection.size}</Text>
              </View>
            )}
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>检查进度</Text>
              <Text style={styles.progressValue}>{progress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{inspection.checkedCount}</Text>
                <Text style={styles.statLabel}>已检查</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#FF6B6B' }]}>
                  {defectStats.critical + defectStats.serious + defectStats.minor}
                </Text>
                <Text style={styles.statLabel}>缺陷数</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#00B894' }]}>
                  {inspection.checklist_items.length - inspection.checkedCount}
                </Text>
                <Text style={styles.statLabel}>待检查</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 验货清单 */}
        {categories.filter(c => c !== '条码').map((category, catIndex) => {
          return (
            <View key={category} style={styles.section}>
              <View style={styles.categoryHeader}>
                <Text style={styles.sectionTitle}>{category}</Text>
              </View>
              {inspection.checklist_items
                .filter(item => item.category === category)
              .map(item => (
                <View key={item.record_id} style={styles.checklistItem}>
                  <View style={styles.checklistHeader}>
                    <View style={styles.checklistInfo}>
                      {item.name && item.name !== '条码扫描' && (
                        <Text style={styles.checklistName}>{item.name}</Text>
                      )}
                    </View>
                    {item.description && (
                      <Text style={styles.checklistDesc}>{item.description}</Text>
                    )}
                    {item.status !== 'unchecked' && (
                      <View style={[styles.statusIcon, {
                        backgroundColor: item.status === 'pass' ? 'rgba(0,184,148,0.15)' : 'rgba(255,107,107,0.15)'
                      }]}>
                        <Feather name={item.status === 'pass' ? 'check' : 'x'} size={16}
                          color={item.status === 'pass' ? '#00B894' : '#FF6B6B'} />
                      </View>
                    )}
                  </View>

                  {/* 临时拍照预览区 - 仅对当前选中的清单项显示 */}
                  {tempPhotoTarget && String(tempPhotoTarget.record_id) === String(item.record_id) ? (
                    <View style={styles.tempPhotoSection}>
                      <View style={styles.tempPhotoHeader}>
                        <Text style={styles.tempPhotoTitle}>拍照中 - {item.name}</Text>
                        <Text style={styles.tempPhotoCount}>已拍 {tempPhotos.length} 张</Text>
                      </View>
                      <View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tempPhotoScroll}>
                          {tempPhotos.map((uri, idx) => (
                            <TouchableOpacity key={idx} style={styles.tempPhotoContainer}>
                              <Image source={{ uri }} style={styles.tempPhotoThumb} />
                              <View style={styles.tempPhotoBadge}>
                                <Text style={styles.tempPhotoBadgeText}>{idx + 1}</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                          {/* 继续拍照按钮 */}
                          <TouchableOpacity style={styles.addPhotoButton} onPress={() => takePhoto(item)}>
                            <Feather name="camera" size={24} color="#6C63FF" />
                            <Text style={styles.addPhotoText}>继续拍</Text>
                          </TouchableOpacity>
                        </ScrollView>
                      </View>
                      {/* 完成按钮 */}
                      <TouchableOpacity style={styles.completePhotoButton} onPress={handleCompletePhotos}>
                        <Feather name="check" size={20} color="#FFFFFF" />
                        <Text style={styles.completePhotoText}>完成 ({tempPhotos.length}张)</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      {/* 已保存的照片预览 */}
                      {item.photos && item.photos.length > 0 && (
                        <View style={styles.photoPreviewSection}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoPreviewScroll}>
                            {item.photos.map((photo, idx) => (
                              <TouchableOpacity key={idx} onPress={() => {
                                setSelectedPhoto(photo);
                                setSelectedPhotoItem(item);
                                setSelectedPhotoIndex(idx);
                                setPhotoModalVisible(true);
                              }} style={styles.photoContainer}>
                                <Image source={{ uri: photo }} style={styles.photoThumb} />
                                <View style={styles.photoBadge}>
                                  <Text style={styles.photoBadgeText}>{idx + 1}</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      {item.status === 'unchecked' && inspection.status !== 'completed' && (
                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.passButton]}
                            onPress={() => updateChecklistItem(item, 'pass')}
                          >
                            <Feather name="check" size={18} color="#00B894" />
                            <Text style={styles.passButtonText}>合格</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.failButton]}
                            onPress={() => {
                              setSelectedItem(item);
                              setDefectModalVisible(true);
                            }}
                          >
                            <Feather name="x" size={18} color="#FF6B6B" />
                            <Text style={styles.failButtonText}>不合格</Text>
                          </TouchableOpacity>
                          {/* 条码分类显示扫码按钮 */}
                          {item.category === '条码' && (
                            <TouchableOpacity
                              style={[styles.actionButton, styles.scanButton]}
                              onPress={() => openBarcodeScanner(item)}
                            >
                              <Feather name="maximize-2" size={18} color="#6C63FF" />
                              <Text style={styles.scanButtonText}>扫码</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.actionButton, styles.photoButton]}
                            onPress={() => takePhoto(item)}
                          >
                            <Feather name="camera" size={18} color="#6C63FF" />
                            <Text style={styles.photoButtonText}>拍照</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* 显示已扫描的条码 */}
                      {item.barcodeCodes && item.barcodeCodes.length > 0 && (
                        <View style={styles.barcodePreviewSection}>
                          <Text style={styles.barcodePreviewLabel}>已扫描条码 ({item.barcodeCodes.length})</Text>
                          <View style={styles.barcodeCodesRow}>
                            {item.barcodeCodes.map((code, idx) => (
                              <View key={idx} style={styles.barcodeCodeItem}>
                                <Feather name="code" size={14} color="#6C63FF" />
                                <Text style={styles.barcodeCodeText} numberOfLines={1}>{code}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </>
                  )}

                </View>
              ))}
            </View>
          );
        })}

        {/* 条码扫描分类 - 问题描述格式 */}
        {categories.includes('条码') && (
          <View style={styles.section}>
            <View style={styles.categoryHeader}>
              <Text style={styles.sectionTitle}> </Text>
              <TouchableOpacity style={styles.addIssueButton} onPress={handleAddBarcode}>
                <Feather name="plus" size={18} color="#6C63FF" />
                <Text style={styles.addIssueText}>添加条码扫描</Text>
              </TouchableOpacity>
            </View>
            
            {/* 条码扫描列表（包括原始项和新增项） */}
            {barcodeItems.map((item, index) => {
              // 判断是否是新增的条码扫描项
              const isExtraItem = item.record_id > 1000000000000;
              return (
                <View key={item.record_id} style={styles.issueItem}>
                  <View style={styles.issueHeader}>
                    <View style={styles.issueNumber}>
                      <Text style={styles.issueNumberText}>{index + 1}</Text>
                    </View>
                    {/* 条码类型下拉选择 - 使用自定义弹窗 */}
                    <TouchableOpacity 
                      style={[
                        styles.barcodeTypeSelector,
                        item.barcodeType && {
                          backgroundColor: barcodeTypeOptions.find(o => o.value === item.barcodeType)?.bgColor,
                          borderColor: barcodeTypeOptions.find(o => o.value === item.barcodeType)?.color,
                        }
                      ]} 
                      onPress={() => openBarcodeTypeSelector(index)}
                    >
                      <Text style={[
                        styles.barcodeTypeSelectorText,
                        item.barcodeType && {
                          color: barcodeTypeOptions.find(o => o.value === item.barcodeType)?.color,
                          fontWeight: '700',
                        },
                        !item.barcodeType && styles.barcodeTypeSelectorPlaceholder
                      ]}>
                        {item.barcodeType 
                          ? barcodeTypeOptions.find(o => o.value === item.barcodeType)?.label 
                          : '选择类型'}
                      </Text>
                      <Feather name="chevron-down" size={16} color={item.barcodeType ? barcodeTypeOptions.find(o => o.value === item.barcodeType)?.color : '#666'} />
                    </TouchableOpacity>
                    {item.name && item.name !== '条码扫描' && (
                      <Text style={styles.checklistName}>{item.name}</Text>
                    )}
                    {item.status !== 'unchecked' && (
                      <View style={[styles.statusIcon, {
                        backgroundColor: item.status === 'pass' ? 'rgba(0,184,148,0.15)' : 'rgba(255,107,107,0.15)'
                      }]}>
                        <Feather name={item.status === 'pass' ? 'check' : 'x'} size={16}
                          color={item.status === 'pass' ? '#00B894' : '#FF6B6B'} />
                      </View>
                    )}
                    {/* 删除按钮 - 仅对新增的条码扫描项显示 */}
                    {isExtraItem && (
                      <TouchableOpacity 
                        style={styles.removeIssueButton} 
                        onPress={() => {
                          setExtraBarcodeItems(extraBarcodeItems.filter(i => i.record_id !== item.record_id));
                        }}
                      >
                        <Feather name="x" size={16} color="#FF6B6B" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {item.description && (
                    <Text style={styles.checklistDesc}>{item.description}</Text>
                  )}
                  
                  {/* 已扫描的条码 */}
                  {item.barcodeCodes && item.barcodeCodes.length > 0 && (
                    <View style={styles.barcodePreviewSection}>
                      <View style={styles.barcodeCodesRow}>
                        {item.barcodeCodes.map((code, idx) => (
                          <View key={idx} style={styles.barcodeCodeItem}>
                            <Feather name="code" size={14} color="#6C63FF" />
                            <Text style={styles.barcodeCodeText} numberOfLines={1}>{code}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {/* 已保存的照片预览 */}
                  {item.photos && item.photos.length > 0 && (
                    <View style={styles.issuePhotosContainer}>
                      {item.photos.map((photo, idx) => (
                        <View key={idx} style={styles.issuePhotoItem}>
                          <Image source={{ uri: photo }} style={styles.issuePhoto} />
                          {/* 删除按钮 */}
                          <TouchableOpacity style={styles.removeIssuePhotoButton}
                            onPress={() => {
                              const updatedItems = extraBarcodeItems.map(barcodeItem => {
                                if (barcodeItem.record_id === item.record_id) {
                                  return { ...barcodeItem, photos: (barcodeItem.photos || []).filter((_, i) => i !== idx) };
                                }
                                return barcodeItem;
                              });
                              setExtraBarcodeItems(updatedItems);
                            }}>
                            <Feather name="x" size={12} color="#FFFFFF" />
                          </TouchableOpacity>
                          {/* 编辑按钮 */}
                          <TouchableOpacity style={styles.editIssuePhotoButton}
                            onPress={() => {
                              setEditingPhoto({ uri: photo, recordId: item.record_id, index: idx });
                              setTempPhotos([photo]);
                              setTempPhotoTarget(item);
                              setCameraVisible(true);
                            }}>
                            <Feather name="edit-2" size={12} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {/* 拍照和扫码按钮 */}
                  <View style={styles.issueCameraRow}>
                    <TouchableOpacity style={styles.issueCameraButton} onPress={() => takePhoto(item)}>
                      <Feather name="camera" size={18} color="#6C63FF" />
                      <Text style={styles.issueCameraText}>拍照</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.issueCameraButton, { marginLeft: 12 }]} 
                      onPress={() => openBarcodeScanner(item)}
                    >
                      <Feather name="maximize-2" size={18} color="#6C63FF" />
                      <Text style={styles.issueCameraText}>扫码</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* 合格与不合格按钮 */}
                  {item.status === 'unchecked' && inspection.status !== 'completed' && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.passButton]}
                        onPress={() => updateChecklistItem(item, 'pass')}
                      >
                        <Feather name="check" size={18} color="#00B894" />
                        <Text style={styles.passButtonText}>合格</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.failButton]}
                        onPress={() => {
                          setSelectedItem(item);
                          setDefectModalVisible(true);
                        }}
                      >
                        <Feather name="x" size={18} color="#FF6B6B" />
                        <Text style={styles.failButtonText}>不合格</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* 问题描述列表 */}
        {issues.length > 0 && (
          <View style={styles.section}>
            <View style={styles.categoryHeader}>
              <Text style={styles.sectionTitle}>问题描述</Text>
              <TouchableOpacity style={styles.addIssueButton} onPress={handleAddIssue}>
                <Feather name="plus" size={18} color="#6C63FF" />
                <Text style={styles.addIssueText}>添加问题</Text>
              </TouchableOpacity>
            </View>
            
            {/* 缺陷统计表格 */}
            <View style={styles.defectStatsContainer}>
              <Text style={styles.defectStatsTitle}>缺陷统计</Text>
              <View style={styles.defectStatsTable}>
                <View style={styles.defectStatsRow}>
                  <Text style={styles.defectStatsLabel}>致命缺陷</Text>
                  <View style={styles.defectStatsInputWrapper}>
                    <TouchableOpacity 
                      style={styles.defectStatsBtn}
                      onPress={() => setDefectStats({...defectStats, critical: Math.max(0, defectStats.critical - 1)})}
                    >
                      <Feather name="minus" size={16} color="#6C63FF" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.defectStatsInput}
                      value={String(defectStats.critical)}
                      onChangeText={(text) => setDefectStats({...defectStats, critical: parseInt(text) || 0})}
                      keyboardType="number-pad"
                      textAlign="center"
                    />
                    <TouchableOpacity 
                      style={styles.defectStatsBtn}
                      onPress={() => setDefectStats({...defectStats, critical: defectStats.critical + 1})}
                    >
                      <Feather name="plus" size={16} color="#6C63FF" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.defectStatsRow}>
                  <Text style={styles.defectStatsLabel}>严重缺陷</Text>
                  <View style={styles.defectStatsInputWrapper}>
                    <TouchableOpacity 
                      style={styles.defectStatsBtn}
                      onPress={() => setDefectStats({...defectStats, serious: Math.max(0, defectStats.serious - 1)})}
                    >
                      <Feather name="minus" size={16} color="#6C63FF" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.defectStatsInput}
                      value={String(defectStats.serious)}
                      onChangeText={(text) => setDefectStats({...defectStats, serious: parseInt(text) || 0})}
                      keyboardType="number-pad"
                      textAlign="center"
                    />
                    <TouchableOpacity 
                      style={styles.defectStatsBtn}
                      onPress={() => setDefectStats({...defectStats, serious: defectStats.serious + 1})}
                    >
                      <Feather name="plus" size={16} color="#6C63FF" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.defectStatsRow}>
                  <Text style={styles.defectStatsLabel}>轻微缺陷</Text>
                  <View style={styles.defectStatsInputWrapper}>
                    <TouchableOpacity 
                      style={styles.defectStatsBtn}
                      onPress={() => setDefectStats({...defectStats, minor: Math.max(0, defectStats.minor - 1)})}
                    >
                      <Feather name="minus" size={16} color="#6C63FF" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.defectStatsInput}
                      value={String(defectStats.minor)}
                      onChangeText={(text) => setDefectStats({...defectStats, minor: parseInt(text) || 0})}
                      keyboardType="number-pad"
                      textAlign="center"
                    />
                    <TouchableOpacity 
                      style={styles.defectStatsBtn}
                      onPress={() => setDefectStats({...defectStats, minor: defectStats.minor + 1})}
                    >
                      <Feather name="plus" size={16} color="#6C63FF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
            
            {issues.map((issue, index) => (
              <View key={index} style={styles.issueItem}>
                <View style={styles.issueHeader}>
                  <View style={styles.issueNumber}>
                    <Text style={styles.issueNumberText}>{index + 1}</Text>
                  </View>
                  <TouchableOpacity 
                    style={[
                      styles.severitySelector,
                      issue.severity && {
                        backgroundColor: severityOptions.find(o => o.value === issue.severity)?.bgColor,
                        borderColor: severityOptions.find(o => o.value === issue.severity)?.color,
                      }
                    ]} 
                    onPress={() => openSeveritySelector(index)}
                  >
                    <Text style={[
                      styles.severitySelectorText,
                      issue.severity && {
                        color: severityOptions.find(o => o.value === issue.severity)?.color,
                        fontWeight: '700',
                      },
                      !issue.severity && styles.severitySelectorPlaceholder
                    ]}>
                      {issue.severity 
                        ? severityOptions.find(o => o.value === issue.severity)?.label 
                        : '选择缺陷等级'}
                    </Text>
                    <Feather name="chevron-down" size={16} color={issue.severity ? severityOptions.find(o => o.value === issue.severity)?.color : '#666'} />
                  </TouchableOpacity>
                  {issues.length > 1 && (
                    <TouchableOpacity style={styles.removeIssueButton} onPress={() => handleRemoveIssue(index)}>
                      <Feather name="x" size={16} color="#FF6B6B" />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={styles.issueInput}
                  placeholder="请输入问题描述..."
                  placeholderTextColor="#B2BEC3"
                  multiline
                  value={issue.text}
                  onChangeText={(text) => handleIssueChange(index, text)}
                />
                {/* 问题照片预览 */}
                {issue.photos.length > 0 && (
                  <View style={styles.issuePhotosContainer}>
                    {issue.photos.map((photo, photoIndex) => (
                      <View key={photoIndex} style={styles.issuePhotoItem}>
                        <Image source={{ uri: photo }} style={styles.issuePhoto} />
                        <TouchableOpacity 
                          style={styles.removeIssuePhotoButton}
                          onPress={() => handleRemoveIssuePhoto(index, photoIndex)}
                        >
                          <Feather name="x" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                {/* 拍照按钮 */}
                <TouchableOpacity style={styles.issueCameraButton} onPress={() => handleOpenCamera(index)}>
                  <Feather name="camera" size={18} color="#6C63FF" />
                  <Text style={styles.issueCameraText}>拍照</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 缺陷记录 */}
        {inspection.defects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>缺陷记录 ({inspection.defects.length})</Text>
            {inspection.defects.map(defect => (
              <View key={defect.id} style={styles.defectCard}>
                <View style={styles.defectHeader}>
                  <View style={[styles.severityBadge, {
                    backgroundColor: defect.severity === 'critical' ? 'rgba(255,107,107,0.15)'
                      : defect.severity === 'major' ? 'rgba(253,203,110,0.15)' : 'rgba(14,165,233,0.15)'
                  }]}>
                    <Text style={[styles.severityText, {
                      color: defect.severity === 'critical' ? '#FF6B6B' : defect.severity === 'major' ? '#FDCB6E' : '#0EA5E9'
                    }]}>
                      {defect.severity === 'critical' ? '严重' : defect.severity === 'major' ? '主要' : '次要'}
                    </Text>
                  </View>
                  <Text style={styles.defectItem}>{defect.title}</Text>
                </View>
                <Text style={styles.defectDescription}>{defect.description}</Text>
                {defect.photo_urls && defect.photo_urls.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.defectPhotos}>
                    {defect.photo_urls.map((photo, idx) => (
                      <TouchableOpacity key={idx} onPress={() => {
                        setSelectedPhoto(photo);
                        setPhotoModalVisible(true);
                      }}>
                        <Image source={{ uri: photo }} style={styles.thumbnail} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            ))}
          </View>

        )}

        {/* 已扫描条码 */}
        {scannedCodes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>已扫描条码 ({scannedCodes.length})</Text>
            {scannedCodes.map((code, idx) => (
              <View key={idx} style={styles.scannedCodeItem}>
                <Feather name="code" size={18} color="#6C63FF" />
                <Text style={styles.scannedCodeText}>{code}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 完成按钮 */}
        {inspection.status !== 'completed' && (
          <TouchableOpacity style={styles.completeButton} onPress={handleSubmit}>
            <Text style={styles.completeButtonText}>提交验货报告</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 缺陷记录 Modal */}
      <Modal visible={defectModalVisible} transparent animationType="slide"
        onRequestClose={() => setDefectModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1}
          onPress={() => setDefectModalVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>记录缺陷</Text>
              <TouchableOpacity onPress={() => setDefectModalVisible(false)}>
                <Feather name="x" size={24} color="#636E72" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>检查项目: {selectedItem?.name}</Text>

            <Text style={styles.modalLabel}>缺陷等级</Text>
            <View style={styles.severityButtons}>
              {(['critical', 'major', 'minor'] as const).map(level => (
                <TouchableOpacity
                  key={level}
                  style={[styles.severityButton, defectForm.severity === level && styles.severityButtonActive]}
                  onPress={() => setDefectForm({ ...defectForm, severity: level })}
                >
                  <Text style={[styles.severityButtonText, defectForm.severity === level && styles.severityButtonTextActive]}>
                    {level === 'critical' ? '严重' : level === 'major' ? '主要' : '次要'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>缺陷描述</Text>
            <TextInput
              style={styles.textArea}
              placeholder="请详细描述缺陷情况..."
              placeholderTextColor="#B2BEC3"
              multiline
              numberOfLines={4}
              value={defectForm.description}
              onChangeText={(text) => setDefectForm({ ...defectForm, description: text })}
            />

            <Text style={styles.modalLabel}>缺陷照片</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoActionButton} onPress={() => takePhoto()}>
                <Feather name="camera" size={20} color="#6C63FF" />
                <Text style={styles.photoActionText}>拍照</Text>
              </TouchableOpacity>

            </View>

            {defectPhotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.defectPhotoPreview}>
                {defectPhotos.map((photo, idx) => (
                  <View key={idx} style={styles.defectPhotoItem}>
                    <Image source={{ uri: photo }} style={styles.defectPhotoThumb} />
                    <TouchableOpacity style={styles.removePhotoBtn}
                      onPress={() => setDefectPhotos(prev => prev.filter((_, i) => i !== idx))}>
                      <Feather name="x" size={14} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.submitButton} onPress={handleAddDefect}>
              <Text style={styles.submitButtonText}>确认添加</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 图片预览 Modal */}
      <Modal visible={photoModalVisible} transparent animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}>
        <View style={styles.photoModalOverlay}>
          {selectedPhoto && <Image source={{ uri: selectedPhoto }} style={styles.fullPhoto} resizeMode="contain" />}
          {/* 关闭按钮 */}
          <TouchableOpacity style={styles.closePhotoButton} onPress={() => setPhotoModalVisible(false)}>
            <Feather name="x" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {/* 操作按钮区域 */}
          <View style={styles.photoActionButtons}>
            {/* 编辑按钮 */}
            <TouchableOpacity style={styles.photoActionBtn} onPress={() => {
              if (selectedPhoto && selectedPhotoItem) {
                setPhotoModalVisible(false);
                setEditingPhoto({ uri: selectedPhoto, recordId: selectedPhotoItem.record_id, index: selectedPhotoIndex });
                setTempPhotos([selectedPhoto]);
                setTempPhotoTarget(selectedPhotoItem);
                setCameraVisible(true);
              }
            }}>
              <Feather name="edit-2" size={22} color="#FFFFFF" />
              <Text style={styles.photoActionBtnText}>编辑</Text>
            </TouchableOpacity>
            {/* 删除按钮 */}
            <TouchableOpacity style={[styles.photoActionBtn, styles.deletePhotoBtn]} onPress={() => {
              if (selectedPhotoItem && selectedPhotoIndex >= 0) {
                const updatedChecklist = inspection.checklist_items.map(item => {
                  if (item.record_id === selectedPhotoItem.record_id) {
                    return {
                      ...item,
                      photos: (item.photos || []).filter((_, i) => i !== selectedPhotoIndex)
                    };
                  }
                  return item;
                });
                setInspection({ ...inspection, checklist_items: updatedChecklist });
                setPhotoModalVisible(false);
                setSelectedPhoto(null);
                setSelectedPhotoItem(null);
                setSelectedPhotoIndex(-1);
              }
            }}>
              <Feather name="trash-2" size={22} color="#FFFFFF" />
              <Text style={styles.photoActionBtnText}>删除</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 扫码说明 Modal */}
      <Modal visible={scannerVisible} transparent animationType="slide"
        onRequestClose={() => setScannerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1}
          onPress={() => setScannerVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>条码扫描</Text>
              <TouchableOpacity onPress={() => setScannerVisible(false)}>
                <Feather name="x" size={24} color="#636E72" />
              </TouchableOpacity>
            </View>

            <View style={styles.scannerInfo}>
              <Feather name="info" size={20} color="#6C63FF" />
              <Text style={styles.scannerInfoText}>
                扫描产品条码记录验货信息{'\n'}
                请使用专业扫码设备或扫码APP
              </Text>
            </View>

            <Text style={styles.modalLabel}>手动输入条码</Text>
            <View style={styles.barcodeInput}>
              <TextInput
                style={styles.barcodeTextInput}
                placeholder="请输入条码"
                placeholderTextColor="#B2BEC3"
                value={''}
                onChangeText={(text) => {
                  if (text.trim()) {
                    setScannedCodes(prev => [...prev, text.trim()]);
                  }
                }}
              />
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={() => setScannerVisible(false)}>
              <Text style={styles.submitButtonText}>完成</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 条码扫码 Modal */}
      <Modal visible={barcodeScannerVisible} animationType="slide"
        onRequestClose={closeBarcodeScanner}>
        <View style={styles.barcodeScannerContainer}>
          {/* 顶部栏 */}
          <View style={styles.barcodeScannerHeader}>
            <TouchableOpacity onPress={closeBarcodeScanner}>
              <Feather name="x" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.barcodeScannerTitle}>
              扫描条码 - {barcodeScanTarget?.name || ''}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* 相机预览 */}
          {barcodePermission?.granted ? (
            <View style={styles.cameraContainer}>
              <CameraView
                ref={barcodeCameraRef}
                style={styles.barcodeCamera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ["qr", "ean13", "ean8", "code39", "code93", "code128", "upc_a", "upc_e", "pdf417", "aztec", "datamatrix", "itf14"],
                }}
                onBarcodeScanned={handleBarcodeScanned}
              >
                {/* 扫描框 */}
                <View style={styles.scanFrame}>
                  <View style={[styles.scanCorner, styles.scanCornerTL]} />
                  <View style={[styles.scanCorner, styles.scanCornerTR]} />
                  <View style={[styles.scanCorner, styles.scanCornerBL]} />
                  <View style={[styles.scanCorner, styles.scanCornerBR]} />
                </View>
              </CameraView>
            </View>
          ) : (
            <View style={styles.barcodePermissionContainer}>
              <Text style={styles.barcodePermissionText}>需要相机权限来扫描条码</Text>
              <TouchableOpacity style={styles.barcodePermissionButton} onPress={requestBarcodePermission}>
                <Text style={styles.barcodePermissionButtonText}>授予权限</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 底部提示 */}
          <View style={styles.barcodeScannerFooter}>
            <Text style={styles.barcodeScannerHint}>将条码对准扫描框内</Text>
            <Text style={styles.barcodeScannerHintSub}>支持二维码、 EAN、 UPC、 Code 等格式</Text>
          </View>
        </View>
      </Modal>

      {/* 问题描述相机 - 使用统一的 CustomCamera 组件 */}
      <CustomCamera
        visible={issueCameraVisible}
        onClose={handleCloseCamera}
        onComplete={handleIssueCameraComplete}
        itemName="问题拍照"
      />
      
      {/* 严重程度选择弹窗 */}
      <Modal
        visible={severityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSeveritySelector}
      >
        <TouchableWithoutFeedback onPress={closeSeveritySelector}>
          <View style={styles.severityModalOverlay}>
            <View style={styles.severityModalContent}>
              <Text style={styles.severityModalTitle}>选择缺陷等级</Text>
              {severityOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.severityModalItem,
                    selectedIssueIndex !== null && issues[selectedIssueIndex]?.severity === option.value && styles.severityModalItemSelected
                  ]}
                  onPress={() => selectedIssueIndex !== null && handleSeverityChange(selectedIssueIndex, option.value)}
                >
                  <View style={[styles.severityDot, { backgroundColor: option.color }]} />
                  <Text style={styles.severityModalItemText}>{option.label}</Text>
                  {selectedIssueIndex !== null && issues[selectedIssueIndex]?.severity === option.value && (
                    <Feather name="check" size={18} color={option.color} />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.severityModalCancel} onPress={closeSeveritySelector}>
                <Text style={styles.severityModalCancelText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 条码类型选择弹窗 */}
      <Modal
        visible={barcodeTypeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeBarcodeTypeSelector}
      >
        <TouchableWithoutFeedback onPress={closeBarcodeTypeSelector}>
          <View style={styles.severityModalOverlay}>
            <View style={styles.severityModalContent}>
              <Text style={styles.severityModalTitle}>选择条码类型</Text>
              {barcodeTypeOptions.map((option) => {
                  const currentItem = selectedBarcodeIndex !== null ? extraBarcodeItems[selectedBarcodeIndex] : null;
                  const isSelected = currentItem?.barcodeType === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.severityModalItem,
                        isSelected && styles.severityModalItemSelected
                      ]}
                      onPress={() => handleBarcodeTypeChange(option.value)}
                    >
                      <View style={[styles.severityDot, { backgroundColor: option.color }]} />
                      <Text style={styles.severityModalItemText}>{option.label}</Text>
                      {isSelected && (
                        <Feather name="check" size={18} color={option.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              <TouchableOpacity style={styles.severityModalCancel} onPress={closeBarcodeTypeSelector}>
                <Text style={styles.severityModalCancelText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerMain: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 4,
  },
  supplierName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
  },
  productName: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressSection: {},
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6C63FF',
  },
  progressBar: {
    height: 10,
    backgroundColor: '#E8E8EB',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8EB',
  },
  basicInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  basicInfoItem: {
    width: '50%',
    paddingVertical: 6,
  },
  basicInfoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  basicInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6C63FF',
  },
  statLabel: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E8E8EB',
  },
  actionBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    gap: 16,
  },
  actionBarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderRadius: 12,
    gap: 8,
  },
  actionBarIconContainer: {
    position: 'relative',
  },
  actionBarBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  actionBarBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  actionBarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C63FF',
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
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderRadius: 8,
    gap: 4,
  },
  categoryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C63FF',
  },
  scanButton: {
    backgroundColor: 'rgba(108,99,255,0.1)',
  },
  scanButtonText: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: '500',
  },
  categoryPhotosPreview: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  categoryPhotosRow: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryPhotoThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  categoryPhotoMore: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(108,99,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryPhotoMoreText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryPhotosCount: {
    fontSize: 12,
    color: '#6C63FF',
    marginTop: 6,
    textAlign: 'center',
  },
  checklistItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checklistInfo: {
    flex: 1,
  },
  checklistName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
  },
  checklistDesc: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 4,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 临时拍照区域样式
  tempPhotoSection: {
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  tempPhotoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tempPhotoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C63FF',
  },
  tempPhotoCount: {
    fontSize: 13,
    color: '#6C63FF',
  },
  tempPhotoScroll: {
    flexDirection: 'row',
  },
  tempPhotoContainer: {
    marginRight: 10,
    position: 'relative',
  },
  tempPhotoThumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#6C63FF',
  },
  tempPhotoBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempPhotoBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addPhotoButton: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#6C63FF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(108,99,255,0.05)',
  },
  addPhotoText: {
    fontSize: 11,
    color: '#6C63FF',
    marginTop: 4,
  },
  completePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 12,
    gap: 8,
  },
  completePhotoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  passButton: {
    backgroundColor: 'rgba(0,184,148,0.15)',
  },
  passButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00B894',
  },
  failButton: {
    backgroundColor: 'rgba(255,107,107,0.15)',
  },
  failButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  photoButton: {
    backgroundColor: 'rgba(108,99,255,0.15)',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C63FF',
  },
  photoRow: {
    marginTop: 8,
  },
  photoSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  photoPreviewScroll: {
    marginBottom: 8,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoCountText: {
    fontSize: 13,
    color: '#6C63FF',
    marginLeft: 6,
    fontWeight: '500',
  },
  photoContainer: {
    position: 'relative',
    marginRight: 8,
  },
  photoBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(108, 99, 255, 0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  photoPreviewSection: {
    backgroundColor: '#F5F5FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  photoPreviewLabel: {
    fontSize: 13,
    color: '#6C63FF',
    fontWeight: '600',
    marginBottom: 10,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  defectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  defectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 10,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  defectItem: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
  },
  defectDescription: {
    fontSize: 14,
    color: '#636E72',
    lineHeight: 20,
  },
  defectPhotos: {
    marginTop: 12,
  },
  scannedCodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  scannedCodeText: {
    fontSize: 14,
    color: '#2D3436',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  completeButton: {
    marginTop: 20,
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F0F0F3',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 10,
    marginTop: 16,
  },
  severityButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  severityButtonActive: {
    backgroundColor: '#6C63FF',
  },
  severityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
  },
  severityButtonTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#2D3436',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    gap: 8,
  },
  photoActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C63FF',
  },
  defectPhotoPreview: {
    marginTop: 12,
  },
  defectPhotoItem: {
    marginRight: 8,
    position: 'relative',
  },
  defectPhotoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fullPhoto: {
    width: '100%',
    height: '80%',
  },
  closePhotoButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoActionButtons: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 20,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108,99,255,0.8)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
  },
  deletePhotoBtn: {
    backgroundColor: 'rgba(255,107,107,0.9)',
  },
  photoActionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  scannerInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#636E72',
    lineHeight: 22,
  },
  barcodeInput: {
    marginTop: 8,
  },
  barcodeTextInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#2D3436',
  },
  // 条码扫码样式 (复用 scanButton)
  barcodePreviewSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  barcodePreviewLabel: {
    fontSize: 12,
    color: '#636E72',
    marginBottom: 8,
  },
  barcodeCodesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  barcodeCodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    maxWidth: '45%',
  },
  barcodeCodeText: {
    fontSize: 12,
    color: '#6C63FF',
    fontWeight: '500',
    flexShrink: 1,
  },
  barcodeTypeSelector: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 100,
  },
  barcodeTypeSelectorText: {
    fontSize: 13,
    color: '#333',
  },
  barcodeTypeSelectorPlaceholder: {
    color: '#999',
  },
  // 条码扫码 Modal 样式
  barcodeScannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  barcodeScannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  barcodeScannerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeCamera: {
    width: '100%',
    height: '100%',
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
    marginTop: 100,
  },
  scanCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#6C63FF',
  },
  scanCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  scanCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  scanCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  scanCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  barcodePermissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  barcodePermissionText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  barcodePermissionButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 25,
  },
  barcodePermissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  barcodeScannerFooter: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
  },
  barcodeScannerHint: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  barcodeScannerHintSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  // 问题描述框样式
  addIssueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108,99,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  addIssueText: {
    fontSize: 13,
    color: '#6C63FF',
    fontWeight: '500',
  },
  issueItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  issueNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  issueNumberText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  severitySelector: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  severitySelectorText: {
    fontSize: 14,
    color: '#333',
  },
  severitySelectorPlaceholder: {
    color: '#999',
  },
  issueInput: {
    flex: 1,
    minHeight: 80,
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
    textAlignVertical: 'top',
    padding: 0,
  },
  removeIssueButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,107,107,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  issueContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  issuePhotosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginLeft: 44,
  },
  issuePhotoItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  issuePhoto: {
    width: '100%',
    height: '100%',
  },
  removeIssuePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIssuePhotoButton: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  issueCameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginLeft: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  issueCameraRow: {
    flexDirection: 'row',
    marginTop: 12,
    marginLeft: 44,
  },
  issueSection: {
    marginTop: 16,
  },
  issueCameraText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '500',
  },
  // 缺陷统计表格样式
  defectStatsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  defectStatsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  defectStatsTable: {
    gap: 8,
  },
  defectStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  defectStatsLabel: {
    fontSize: 14,
    color: '#333',
  },
  defectStatsInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  defectStatsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  defectStatsInput: {
    width: 48,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  // 严重程度选择弹窗样式
  severityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  severityModalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  severityModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  severityModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  severityModalItemSelected: {
    backgroundColor: '#F0F0FF',
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  severityModalItemText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  severityModalCancel: {
    marginTop: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  severityModalCancelText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
});
