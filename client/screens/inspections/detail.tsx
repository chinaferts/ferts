import { useState, useCallback, use } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal, Image } from 'react-native';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeRouter } from '@/hooks/useSafeRouter';

interface ChecklistItem {
  id: number;
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'unchecked';
  notes?: string;
  photos?: string[];
}

interface Defect {
  id: number;
  itemName: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  photos: string[];
}

interface InspectionDetail {
  id: number;
  supplier: string;
  product: string;
  status: 'pending' | 'in_progress' | 'completed';
  date: string;
  aql: string;
  sampleSize: number;
  checkedCount: number;
  defectCount: number;
  checklist: ChecklistItem[];
  defects: Defect[];
}

export default function InspectionDetailScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useSafeRouter();
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [defectModalVisible, setDefectModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null);
  const [defectForm, setDefectForm] = useState({
    severity: 'minor' as 'critical' | 'major' | 'minor',
    description: '',
  });
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const fetchInspection = async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/inspections/${id}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        setInspection({
          id: data.id,
          supplier: data.supplier_name || data.supplier || '',
          product: data.product_name || data.product || '',
          status: data.status || 'pending',
          date: data.inspection_date || data.date || '',
          aql: data.aql || '2.5',
          sampleSize: data.sample_size || data.sampleSize || 0,
          checkedCount: data.checked_count || data.checkedCount || 0,
          defectCount: data.defect_count || data.defectCount || 0,
          checklist: (data.checklist_items || data.checklist || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            category: item.category || '',
            status: item.status || 'unchecked',
            notes: item.notes,
            photos: item.photos || [],
          })),
          defects: (data.defects || []).map((d: any) => ({
            id: d.id,
            itemName: d.item_name || d.itemName || '',
            severity: d.severity || 'minor',
            description: d.description || '',
            photos: d.photos || [],
          })),
        });
      }
    } catch (error) {
      console.error('Failed to fetch inspection:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInspection();
    }, [id])
  );

  const updateChecklistItem = async (itemId: number, status: 'pass' | 'fail') => {
    if (!inspection) return;
    
    const updatedChecklist = inspection.checklist.map(item =>
      item.id === itemId ? { ...item, status } : item
    );
    
    const checkedCount = updatedChecklist.filter(i => i.status !== 'unchecked').length;
    const defectCount = updatedChecklist.filter(i => i.status === 'fail').length;
    
    setInspection({
      ...inspection,
      checklist: updatedChecklist,
      checkedCount,
      defectCount,
      status: checkedCount === inspection.checklist.length ? 'completed' : 'in_progress',
    });

    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      await fetch(`${baseUrl}/api/v1/inspections/${id}/checklist/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch (error) {
      console.error('Failed to update checklist item:', error);
    }
  };

  const handleAddDefect = () => {
    if (!selectedItem || !defectForm.description.trim()) {
      Alert.alert('提示', '请填写缺陷描述');
      return;
    }

    const newDefect: Defect = {
      id: Date.now(),
      itemName: selectedItem.name,
      severity: defectForm.severity,
      description: defectForm.description,
      photos: selectedItem.photos || [],
    };

    setInspection(prev => prev ? {
      ...prev,
      defects: [...prev.defects, newDefect],
      defectCount: prev.defectCount + 1,
    } : null);

    setDefectModalVisible(false);
    setDefectForm({ severity: 'minor', description: '' });
    setSelectedItem(null);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('权限不足', '需要相机权限才能拍照');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (selectedItem) {
        setInspection(prev => prev ? {
          ...prev,
          checklist: prev.checklist.map(item =>
            item.id === selectedItem.id
              ? { ...item, photos: [...(item.photos || []), result.assets[0].uri] }
              : item
          ),
        } : null);
      }
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('权限不足', '需要相册权限才能选择图片');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (selectedItem) {
        setInspection(prev => prev ? {
          ...prev,
          checklist: prev.checklist.map(item =>
            item.id === selectedItem.id
              ? { ...item, photos: [...(item.photos || []), result.assets[0].uri] }
              : item
          ),
        } : null);
      }
    }
  };

  if (!inspection) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </Screen>
    );
  }

  const categories = [...new Set(inspection.checklist.map(item => item.category))];
  const progress = Math.round((inspection.checkedCount / inspection.checklist.length) * 100);

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* 头部信息 */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.supplierName}>{inspection.supplier}</Text>
              <Text style={styles.productName}>{inspection.product}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {inspection.status === 'pending' ? '待开始' : inspection.status === 'in_progress' ? '进行中' : '已完成'}
              </Text>
            </View>
          </View>
          
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="calendar" size={16} color="#636E72" />
              <Text style={styles.metaText}>{inspection.date}</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="target" size={16} color="#636E72" />
              <Text style={styles.metaText}>AQL {inspection.aql}</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="layers" size={16} color="#636E72" />
              <Text style={styles.metaText}>抽样 {inspection.sampleSize}件</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>检查进度</Text>
              <Text style={styles.progressValue}>{progress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={['#6C63FF', '#896BFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
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
                <Text style={[styles.statValue, { color: '#00B894' }]}>{inspection.checklist.length - inspection.checkedCount}</Text>
                <Text style={styles.statLabel}>待检查</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 验货清单 */}
        {categories.map(category => (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionTitle}>{category}</Text>
            {inspection.checklist
              .filter(item => item.category === category)
              .map(item => (
                <View key={item.id} style={styles.checklistItem}>
                  <View style={styles.checklistHeader}>
                    <View style={styles.checklistInfo}>
                      <Text style={styles.checklistName}>{item.name}</Text>
                      {item.notes && (
                        <Text style={styles.checklistNotes}>{item.notes}</Text>
                      )}
                    </View>
                    {item.status !== 'unchecked' && (
                      <View style={[styles.statusIcon, { backgroundColor: item.status === 'pass' ? 'rgba(0,184,148,0.15)' : 'rgba(255,107,107,0.15)' }]}>
                        <Feather name={item.status === 'pass' ? 'check' : 'x'} size={16} color={item.status === 'pass' ? '#00B894' : '#FF6B6B'} />
                      </View>
                    )}
                  </View>
                  
                  {item.status === 'unchecked' && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.passButton]}
                        onPress={() => updateChecklistItem(item.id, 'pass')}
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
                          pickImage();
                        }}
                      >
                        <Feather name="camera" size={18} color="#6C63FF" />
                        <Text style={styles.photoButtonText}>拍照</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {item.photos && item.photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                      {item.photos.map((photo, idx) => (
                        <TouchableOpacity key={idx} onPress={() => { setSelectedPhoto(photo); setPhotoModalVisible(true); }}>
                          <Image source={{ uri: photo }} style={styles.thumbnail} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              ))}
          </View>
        ))}

        {/* 缺陷记录 */}
        {inspection.defects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>缺陷记录</Text>
            {inspection.defects.map(defect => (
              <View key={defect.id} style={styles.defectCard}>
                <View style={styles.defectHeader}>
                  <View style={[styles.severityBadge, { backgroundColor: defect.severity === 'critical' ? 'rgba(255,107,107,0.15)' : defect.severity === 'major' ? 'rgba(253,203,110,0.15)' : 'rgba(14,165,233,0.15)' }]}>
                    <Text style={[styles.severityText, { color: defect.severity === 'critical' ? '#FF6B6B' : defect.severity === 'major' ? '#FDCB6E' : '#0EA5E9' }]}>
                      {defect.severity === 'critical' ? '严重' : defect.severity === 'major' ? '主要' : '次要'}
                    </Text>
                  </View>
                  <Text style={styles.defectItem}>{defect.itemName}</Text>
                </View>
                <Text style={styles.defectDescription}>{defect.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 完成按钮 */}
        {inspection.status !== 'completed' && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => {
              Alert.alert(
                '确认完成',
                '确定要提交验货报告吗？',
                [
                  { text: '取消', style: 'cancel' },
                  { text: '确定', onPress: () => router.navigate('/inspections') },
                ]
              );
            }}
          >
            <LinearGradient colors={['#6C63FF', '#896BFF']} style={styles.completeButtonGradient}>
              <Text style={styles.completeButtonText}>提交验货报告</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 缺陷记录 Modal */}
      <Modal visible={defectModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDefectModalVisible(false)}>
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

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.photoActionButton} onPress={takePhoto}>
                <Feather name="camera" size={20} color="#6C63FF" />
                <Text style={styles.photoActionText}>拍照</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoActionButton} onPress={pickImage}>
                <Feather name="image" size={20} color="#6C63FF" />
                <Text style={styles.photoActionText}>相册</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleAddDefect}>
              <LinearGradient colors={['#6C63FF', '#896BFF']} style={styles.submitButtonGradient}>
                <Text style={styles.submitButtonText}>确认添加</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 图片预览 Modal */}
      <Modal visible={photoModalVisible} transparent animationType="fade" onRequestClose={() => setPhotoModalVisible(false)}>
        <TouchableOpacity style={styles.photoModalOverlay} activeOpacity={1} onPress={() => setPhotoModalVisible(false)}>
          {selectedPhoto && <Image source={{ uri: selectedPhoto }} style={styles.fullPhoto} resizeMode="contain" />}
          <TouchableOpacity style={styles.closePhotoButton} onPress={() => setPhotoModalVisible(false)}>
            <Feather name="x" size={24} color="#FFFFFF" />
          </TouchableOpacity>
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
    backgroundColor: '#F0F0F3',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
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
    backgroundColor: 'rgba(14,165,233,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0EA5E9',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 20,
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
    backgroundColor: '#F0F0F3',
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
  checklistNotes: {
    fontSize: 13,
    color: '#FF6B6B',
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
    marginTop: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  defectCard: {
    backgroundColor: '#F0F0F3',
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
  completeButton: {
    marginTop: 20,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  completeButtonGradient: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
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
    marginBottom: 8,
    marginTop: 16,
  },
  severityButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#E8E8EB',
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
    backgroundColor: '#E8E8EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#2D3436',
    height: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108,99,255,0.15)',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  photoActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C63FF',
  },
  submitButton: {
    marginTop: 24,
  },
  submitButtonGradient: {
    borderRadius: 16,
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
    width: '90%',
    height: '70%',
  },
  closePhotoButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
