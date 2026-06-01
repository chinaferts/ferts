import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal, Image, Platform } from 'react-native';
import { Screen } from '@/components/Screen';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeRouter } from '@/hooks/useSafeRouter';

interface ChecklistItem {
  id: number;
  record_id: number;
  name: string;
  description?: string;
  category: string;
  status: 'pass' | 'fail' | 'unchecked';
  notes?: string;
  photos?: string[];
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
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);

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

  // 拍照功能
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('权限不足', '需要相机权限才能拍照');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (selectedItem) {
        // 为检查项添加照片 - 使用 record_id 字符串比较确保类型一致
        const targetRecordId = String(selectedItem.record_id);
        const updatedItems = inspection?.checklist_items.map(i =>
          String(i.record_id) === targetRecordId
            ? { ...i, photos: [...(i.photos || []), uri] }
            : i
        );
        setInspection(prev => prev ? { ...prev, checklist_items: updatedItems || [] } : null);
      } else {
        // 为缺陷添加照片
        setDefectPhotos(prev => [...prev, uri]);
      }
    }
  };

  // 从相册选择
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('权限不足', '需要相册权限才能选择图片');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (selectedItem) {
        // 为检查项添加照片 - 使用 record_id 字符串比较确保类型一致
        const targetRecordId = String(selectedItem.record_id);
        const updatedItems = inspection?.checklist_items.map(i =>
          String(i.record_id) === targetRecordId
            ? { ...i, photos: [...(i.photos || []), uri] }
            : i
        );
        setInspection(prev => prev ? { ...prev, checklist_items: updatedItems || [] } : null);
      } else {
        setDefectPhotos(prev => [...prev, uri]);
      }
    }
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
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* 头部信息 */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.supplierName}>{inspection.supplier_name}</Text>
              <Text style={styles.productName}>{inspection.product_name}</Text>
            </View>
            <View style={[styles.statusBadge, {
              backgroundColor: inspection.status === 'completed' ? 'rgba(0,184,148,0.15)' : 'rgba(14,165,233,0.15)'
            }]}>
              <Text style={[styles.statusText, { color: inspection.status === 'completed' ? '#00B894' : '#0EA5E9' }]}>
                {inspection.status === 'pending' ? '待开始' : inspection.status === 'in_progress' ? '进行中' : '已完成'}
              </Text>
            </View>
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
                <Text style={[styles.statValue, { color: '#FF6B6B' }]}>{inspection.defectCount}</Text>
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
        {categories.map(category => {
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
                      <Text style={styles.checklistName}>{item.name}</Text>
                      {item.description && (
                        <Text style={styles.checklistDesc}>{item.description}</Text>
                      )}
                    </View>
                    {item.status !== 'unchecked' && (
                      <View style={[styles.statusIcon, {
                        backgroundColor: item.status === 'pass' ? 'rgba(0,184,148,0.15)' : 'rgba(255,107,107,0.15)'
                      }]}>
                        <Feather name={item.status === 'pass' ? 'check' : 'x'} size={16}
                          color={item.status === 'pass' ? '#00B894' : '#FF6B6B'} />
                      </View>
                    )}
                  </View>

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
                      <TouchableOpacity
                        style={[styles.actionButton, styles.photoButton]}
                        onPress={() => {
                          setSelectedItem(item);
                          takePhoto();
                        }}
                      >
                        <Feather name="camera" size={18} color="#6C63FF" />
                        <Text style={styles.photoButtonText}>拍照</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {item.photos && item.photos.length > 0 && (
                    <View style={styles.photoSection}>
                      <View style={styles.photoHeader}>
                        <Feather name="image" size={14} color="#6C63FF" />
                        <Text style={styles.photoCountText}>照片 ({item.photos.length})</Text>
                      </View>
                      <View style={styles.photoRow}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {item.photos.map((photo, idx) => (
                            <TouchableOpacity key={idx} onPress={() => {
                              setSelectedPhoto(photo);
                              setPhotoModalVisible(true);
                            }} style={styles.photoContainer}>
                              <Image source={{ uri: photo }} style={styles.thumbnail} />
                              <View style={styles.photoBadge}>
                                <Text style={styles.photoBadgeText}>{idx + 1}</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })}

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
              <TouchableOpacity style={styles.photoActionButton} onPress={takePhoto}>
                <Feather name="camera" size={20} color="#6C63FF" />
                <Text style={styles.photoActionText}>拍照</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoActionButton} onPress={pickImage}>
                <Feather name="image" size={20} color="#6C63FF" />
                <Text style={styles.photoActionText}>相册</Text>
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
        <TouchableOpacity style={styles.photoModalOverlay} activeOpacity={1}
          onPress={() => setPhotoModalVisible(false)}>
          {selectedPhoto && <Image source={{ uri: selectedPhoto }} style={styles.fullPhoto} resizeMode="contain" />}
          <TouchableOpacity style={styles.closePhotoButton} onPress={() => setPhotoModalVisible(false)}>
            <Feather name="x" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </TouchableOpacity>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  supplierName: {
    fontSize: 20,
    fontWeight: '800',
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
    backgroundColor: 'rgba(0,189,126,0.1)',
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
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
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
});
