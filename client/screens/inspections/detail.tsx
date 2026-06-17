import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal, Image, Platform, TouchableWithoutFeedback, ActivityIndicator, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Screen } from '@/components/Screen';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { createFormDataFile } from '@/utils';
import CustomCamera from '@/components/CustomCamera';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image as ExpoImage } from 'expo-image';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

// 获取完整的图片 URL（同步版本，用于 Image source）
const getImageUrl = (photo: string): string => {
  console.log('[getImageUrl] 输入:', photo, ', 类型:', typeof photo);
  if (!photo) {
    console.log('[getImageUrl] 照片为空');
    return '';
  }
  
  // 如果是完整 URL 或 data URI（base64），直接返回
  if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('data:')) {
    return photo;
  }
  
  // 如果是本地文件 URI（包括 file://、content://、ph://），直接返回
  // 这些是设备本地路径，可能是当前设备拍摄的 photo:// 或文件路径
  if (photo.startsWith('file:') || photo.startsWith('content://') || photo.startsWith('ph://')) {
    console.log('[getImageUrl] 本地文件 URI，直接返回:', photo.substring(0, 50));
    return photo;
  }
  
  // 如果是相对路径，拼接到服务器 URL
  const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || '';
  const result = photo.startsWith('/') ? `${baseUrl}${photo}` : `${baseUrl}/${photo}`;
  console.log('[getImageUrl] 相对路径转换:', result);
  return result;
};

// 分类中英文对照映射
const categoryBilingualMap: Record<string, string> = {
  '大货仓库照以及码堆照片': '大货仓库照以及码堆照片',
  '外箱箱唛以及尺寸重量拍照': '外箱箱唛以及尺寸重量拍照',
  '内箱箱唛以及尺寸重量拍照': '内箱箱唛以及尺寸重量拍照',
  '产品细节拍照（包括产品尺寸和重量照）': '产品细节拍照（包括产品尺寸和重量照）',
  '产品细节拍照': '产品细节拍照',
  '彩盒/彩卡信息以及其规格重量拍照': '彩盒/彩卡信息以及其规格重量拍照',
  '与签样对比拍照': '与签样对比拍照',
  '组装以及功能测试拍照': '组装以及功能测试拍照',
  '条码扫描以及拍照': '条码扫描以及拍照',
  '条码扫描': '条码扫描',
  '问题统计以及拍照并描述': '问题统计以及拍照并描述',
  '问题描述': '问题描述',
  '仓库': '大货仓库照以及码堆照片',
  '外箱': '外箱箱唛以及尺寸重量拍照',
  '内箱': '内箱箱唛以及尺寸重量拍照',
  '产品': '产品细节拍照',
  '彩盒': '彩盒/彩卡信息以及其规格重量拍照',
  '对比': '与签样对比拍照',
  '组装': '组装以及功能测试拍照',
  '条码': '条码扫描以及拍照',
};

// 分类英文标题映射
const categoryEnglishMap: Record<string, string> = {
  '大货仓库照以及码堆照片': 'Warehouse & Stacking',
  '外箱箱唛以及尺寸重量拍照': 'Carton Marking & Dimensions',
  '内箱箱唛以及尺寸重量拍照': 'Inner Carton Marking & Dimensions',
  '产品细节拍照（包括产品尺寸和重量照）': 'Product Detail',
  '产品细节拍照': 'Product Detail',
  '彩盒/彩卡信息以及其规格重量拍照': 'Color Box/Manual & Specs',
  '与签样对比拍照': 'Sample Comparison',
  '组装以及功能测试拍照': 'Assembly & Function Test',
  '条码扫描以及拍照': 'Barcode Scan',
  '条码扫描': 'Barcode Scan',
  '问题统计以及拍照并描述': 'Problem Statistics',
  '问题描述': 'Problem Statistics',
  '仓库': 'Warehouse & Stacking',
  '外箱': 'Carton Marking & Dimensions',
  '内箱': 'Inner Carton Marking & Dimensions',
  '产品': 'Product Detail',
  '彩盒': 'Color Box/Manual & Specs',
  '对比': 'Sample Comparison',
  '组装': 'Assembly & Function Test',
  '条码': 'Barcode Scan',
};

// 检查项名称中英文对照映射
const checklistItemBilingualMap: Record<string, string> = {
  '检查外箱箱唛及尺寸重量': '检查外箱箱唛及尺寸重量',
  '检查内箱箱唛及尺寸重量': '检查内箱箱唛及尺寸重量',
  '检查产品尺寸': '检查产品尺寸',
  '检查产品重量': '检查产品重量',
  '检查彩盒信息': '检查彩盒信息',
  '检查组装': '检查组装',
  '检查功能': '检查功能',
  '扫描条码': '扫描条码',
  '拍照存档': '拍照存档',
  '检查外观': '检查外观',
  '检查标签': '检查标签',
  '功能测试': '功能测试',
  '尺寸测量': '尺寸测量',
  '重量测量': '重量测量',
  '包装检查': '包装检查',
};

// 检查项英文标题映射
const checklistItemEnglishMap: Record<string, string> = {
  '检查外箱箱唛及尺寸重量': 'Check Carton Marking & Dimensions',
  '检查内箱箱唛及尺寸重量': 'Check Inner Carton Marking & Dimensions',
  '检查产品尺寸': 'Check Product Dimensions',
  '检查产品重量': 'Check Product Weight',
  '检查彩盒信息': 'Check Color Box Info',
  '检查组装': 'Check Assembly',
  '检查功能': 'Check Function',
  '扫描条码': 'Scan Barcode',
  '拍照存档': 'Photo Record',
  '检查外观': 'Check Appearance',
  '检查标签': 'Check Label',
  '功能测试': 'Function Test',
  '尺寸测量': 'Dimension Measurement',
  '重量测量': 'Weight Measurement',
  '包装检查': 'Packaging Check',
};

interface ChecklistItem {
  id: number;
  record_id: number;
  name: string;
  description?: string;
  category: string;
  status: 'pass' | 'fail' | 'na' | 'unchecked';
  notes?: string;
  photos?: string[];
  barcodeCodes?: string[];  // 条码扫描记录
  barcodeType?: 'box' | 'inner' | 'color'; // 条码类型：外箱、内箱/内袋、彩盒/彩卡
  issueIndex?: number; // 动态添加的问题描述索引
  categoryIndex?: number; // 分类索引
  itemIndex?: number; // 项目索引
  type?: string; // 项目类型：'barcode' 等
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
  order_number?: string;
  product_no?: string;
  accept_count?: number;
  reject_count?: number;
  inspection_number?: string;
  checklist_items: ChecklistItem[];
  defects: Defect[];
}

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useSafeRouter();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [defectModalVisible, setDefectModalVisible] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
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
  // 编辑照片相关状态 (支持检查项照片和问题描述照片)
  const [editingPhoto, setEditingPhoto] = useState<{ 
    uri: string; 
    recordId?: number; 
    index?: number;
    issueIndex?: number;
    photoIndex?: number;
    item?: ChecklistItem;
  } | null>(null);
  const [editPhotoModalVisible, setEditPhotoModalVisible] = useState(false);
  // 条码扫码相关状态
  const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false);
  const [barcodeScanTarget, setBarcodeScanTarget] = useState<ChecklistItem | null>(null);
  const [barcodePermission, requestBarcodePermission] = useCameraPermissions();
  const barcodeCameraRef = useRef<CameraView>(null);
  const [hasScannedBarcode, setHasScannedBarcode] = useState(false);
  const [showBarcodeCamera, setShowBarcodeCamera] = useState(false);
  // 使用 ref 同步追踪扫描状态，避免异步问题
  const isScanningRef = useRef(false);
  // 相册权限
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();
  
  // 从相册导入照片 - 直接添加到检查项，不需要点"完成"
  const handleImportPhoto = async (item: ChecklistItem) => {
    const { granted } = await requestMediaPermission();
    if (!granted) {
      Alert.alert(t('noPermission'), t('noPermission'));
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      const photoUri = result.assets[0].uri;
      console.log('[ImportPhoto] 导入的照片 URI:', photoUri);
      console.log('[ImportPhoto] URI 类型:', typeof photoUri);
      console.log('[ImportPhoto] 是否以 file: 开头:', photoUri.startsWith('file:'));
      
      // 同时添加到临时预览区和检查项的 photos 数组
      const currentInspection = inspectionRef.current;
      if (!currentInspection) return;
      
      const updatedItems = currentInspection.checklist_items.map((checkItem) => {
        if (checkItem.record_id === item.record_id) {
          const newPhotos = [...(checkItem.photos || []), photoUri];
          console.log('[ImportPhoto] 更新后的 photos:', newPhotos);
          return { ...checkItem, photos: newPhotos };
        }
        return checkItem;
      });
      setInspection(prev => prev ? { ...prev, checklist_items: updatedItems } : null);
      
      // 也要添加到 tempPhotos 以便在预览区显示
      setTempPhotos(prev => {
        console.log('[ImportPhoto] tempPhotos 之前:', prev);
        const newTempPhotos = [...prev, photoUri];
        console.log('[ImportPhoto] tempPhotos 之后:', newTempPhotos);
        return newTempPhotos;
      });
      
      console.log('[ImportPhoto] Added photo to preview:', photoUri);
    }
  };

  // 相册导入别名
  const handleImportFromGallery = handleImportPhoto;

  // 处理从相册导入的照片
  const handlePhotoTaken = (photoUri: string, item: ChecklistItem) => {
    const targetRecordId = item.record_id;
    
    // 设置临时照片目标
    setTempPhotoTarget(item);
    
    // 创建单张照片对象
    const photo = { uri: photoUri };
    
    // 直接添加照片到检查项
    const currentInspection = inspectionRef.current;
    if (!currentInspection) return;
    
    const updatedItems = currentInspection.checklist_items.map((checkItem) => {
      if (checkItem.record_id === targetRecordId) {
        return { ...checkItem, photos: [...(checkItem.photos || []), photoUri] };
      }
      return checkItem;
    });
    setInspection(prev => prev ? { ...prev, checklist_items: updatedItems } : null);
    
    // 上传照片到服务器（压缩后上传）
    const uploadPhoto = async () => {
      try {
        // 压缩照片：1600x1200像素, 96DPI, 90% JPEG质量
        console.log('[UploadPhoto] 开始压缩照片...');
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          photoUri,
          [{ resize: { width: 1600, height: 1200 } }], // 1600x1200分辨率
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG } // 90% JPEG质量
        );
        console.log('[UploadPhoto] 照片压缩完成:', manipulatedImage.uri);
        
        const filename = `photo_${Date.now()}.jpg`;
        const formData = new FormData();
        formData.append("file", {
          uri: manipulatedImage.uri,
          name: filename,
          type: "image/jpeg",
        } as any);
        formData.append("inspection_id", String(id));
        formData.append("record_id", String(targetRecordId));
        formData.append("category", item.category || item.name);
        formData.append("item_name", item.name);
        
        const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/inspections/${id}/photos`, {
          method: "POST",
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          const photoUrl = result.data?.photo_url || result.photo_url;
          console.log('[UploadPhoto] 服务器返回 URL:', photoUrl);
          
          if (photoUrl) {
            // 替换本地路径为服务器 URL
            const updatedItems = (inspectionRef.current?.checklist_items || []).map((checkItem) => {
              if (checkItem.record_id === targetRecordId) {
                const filteredPhotos = (checkItem.photos || []).filter(p => p !== photoUri);
                return { ...checkItem, photos: [...filteredPhotos, photoUrl] };
              }
              return checkItem;
            });
            setInspection(prev => prev ? { ...prev, checklist_items: updatedItems } : null);
            
            // 同时更新数据库中的 photos 字段
            await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/inspections/${id}/checklist-items/${targetRecordId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ photos: [...(updatedItems.find(i => i.record_id === targetRecordId)?.photos || [])] }),
            });
          }
        } else {
          console.error('[UploadPhoto] 上传失败，状态码:', response.status);
        }
      } catch (error) {
        console.error("上传照片失败:", error);
      }
    };
    
    uploadPhoto();
  };
  
  // 问题描述框状态 (每个问题包含文本、照片和严重程度)
  const [issues, setIssues] = useState<Array<{ text: string; photos: string[]; severity: string }>>([{ text: '', photos: [], severity: '' }]);
  // 条码扫描项状态 (默认显示一条，用户点击添加时才新增)
  const [barcodeItems, setBarcodeItems] = useState<ChecklistItem[]>([]);
  
  // 初始化条码扫描项（默认只显示一条空项）
  // 只有当 barcodeItems 为空时才初始化，避免覆盖用户添加的项
  useEffect(() => {
    if (!inspection?.checklist_items || barcodeItems.length > 0) return;
    
    const originalBarcodeItems = inspection.checklist_items
      .filter(item => item.category === '条码扫描以及拍照')
      .map(item => ({ ...item, barcodeType: 'box' as const, type: 'barcode' as const }));
    // 默认只显示一条，如果已有数据则显示第一条，否则创建一条空项
    if (originalBarcodeItems.length > 0) {
      setBarcodeItems([originalBarcodeItems[0]]);
    } else {
      // 创建一条默认的条码扫描项
      const defaultItem: ChecklistItem = {
        id: Date.now(),
        record_id: Date.now(), // 使用 Date.now() 作为临时 ID，方便后续识别新增项
        name: t('barcodeScan'),
        description: t('barcodeScan'),
        category: '条码扫描以及拍照',
        status: 'unchecked',
        photos: [],
        barcodeCodes: [],
        barcodeType: 'box' as const,
        type: 'barcode' as const,
      };
      setBarcodeItems([defaultItem]);
    }
  }, [inspection?.checklist_items]);
  // 严重程度选项
  const severityOptions = [
    { label: t('criticalDefect'), value: 'critical', color: '#DC3545', bgColor: 'rgba(220,53,69,0.1)' },
    { label: t('majorDefect'), value: 'serious', color: '#FD7E14', bgColor: 'rgba(253,126,20,0.1)' },
    { label: t('minorDefect'), value: 'minor', color: '#FFC107', bgColor: 'rgba(255,193,7,0.15)' },
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
    { label: t('boxBarcodes'), value: 'box', color: '#6C63FF', bgColor: 'rgba(108,99,255,0.1)' },
    { label: t('innerBarcodes'), value: 'inner', color: '#00B894', bgColor: 'rgba(0,184,148,0.1)' },
    { label: t('colorBarcodes'), value: 'color', color: '#FDCB6E', bgColor: 'rgba(253,203,110,0.15)' },
  ];

  // 照片同步状态
  const [isSyncingPhotos, setIsSyncingPhotos] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const isSyncingPhotosRef = useRef(false);

  // 检查是否有本地路径照片需要同步
  const localPhotosCount = inspection?.checklist_items?.reduce((count: number, item: ChecklistItem) => {
    return count + (item.photos?.filter((p: string) => p.startsWith('file:') || p.startsWith('content://')).length || 0);
  }, 0) || 0;

  // 同步本地照片到服务器（自动调用，静默同步）
  const syncPhotosToServer = async () => {
    if (!inspection?.checklist_items || isSyncingPhotosRef.current) return;

    // 收集所有需要同步的本地照片
    const photosToSync: Array<{ itemRecordId: number; photoUri: string; itemIndex: number; photoIndex: number }> = [];
    inspection.checklist_items.forEach((item: ChecklistItem, itemIndex: number) => {
      (item.photos || []).forEach((photo: string, photoIndex: number) => {
        if (photo.startsWith('file:') || photo.startsWith('content://') || photo.startsWith('ph://')) {
          photosToSync.push({ itemRecordId: item.record_id, photoUri: photo, itemIndex, photoIndex });
        }
      });
    });

    if (photosToSync.length === 0) {
      return; // 没有本地照片需要同步
    }

    isSyncingPhotosRef.current = true;
    setIsSyncingPhotos(true);
    setSyncProgress({ current: 0, total: photosToSync.length });

    const updatedItems = JSON.parse(JSON.stringify(inspection.checklist_items));

    try {
      for (let i = 0; i < photosToSync.length; i++) {
        const { itemRecordId, photoUri, itemIndex, photoIndex } = photosToSync[i];
        setSyncProgress({ current: i + 1, total: photosToSync.length });

        try {
          // 读取本地照片文件并转换为Base64
          const base64Data = await (FileSystem as any).readAsStringAsync(photoUri, {
            encoding: (FileSystem as any).EncodingType.Base64,
          });

          // 获取文件扩展名
          const filename = photoUri.split('/').pop() || `photo_${Date.now()}.jpg`;
          const extMatch = /\.(\w+)$/.exec(filename);
          const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
          const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          const base64WithPrefix = `data:${mimeType};base64,${base64Data}`;

          // 调用后端导入接口
          const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/inspections/import-photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              photoData: base64WithPrefix,
              recordId: itemRecordId,
              oldPhotoPath: photoUri,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.serverPath) {
              // 替换本地路径为服务器路径
              updatedItems[itemIndex].photos[photoIndex] = result.serverPath;
            }
          }
        } catch (readError) {
          console.error('[AutoSync] 读取照片失败:', photoUri, readError);
        }
      }

      // 更新前端状态
      setInspection(prev => prev ? { ...prev, checklist_items: updatedItems } : null);
    } catch (error) {
      console.error('[AutoSync] 同步失败:', error);
    } finally {
      isSyncingPhotosRef.current = false;
      setIsSyncingPhotos(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };
  
  // 问题描述框处理函数
  const handleAddIssue = () => {
    setIssues([...issues, { text: '', photos: [], severity: '' }]);
  };
  
  // 添加条码扫描项
  const handleAddBarcode = () => {
    const newItem: ChecklistItem = {
      id: Date.now(),
      record_id: Date.now(),
      name: t('barcodeScan'),
      description: t('barcodeScan'),
      category: '条码扫描以及拍照',
      status: 'unchecked',
      photos: [],
      barcodeCodes: [],
      barcodeType: 'box', // 默认外箱条码
    };
    setBarcodeItems([...barcodeItems, newItem]);
    // 同时添加到 inspection.checklist_items，确保扫码时能找到
    setInspection(prev => {
      if (!prev) return null;
      return {
        ...prev,
        checklist_items: [...(prev.checklist_items || []), { ...newItem }]
      };
    });
  };

  // 更新条码扫描项的类型
  const updateBarcodeItemType = (recordId: number, type: string) => {
    setBarcodeItems(items => items.map(i => 
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
      const item = barcodeItems[selectedBarcodeIndex];
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

  // 更新照片（用于编辑模式下替换照片）
  const handleUpdatePhoto = async (originalUri: string, newUri: string) => {
    if (!inspection) return;
    
    // 更新主检查项的照片
    const currentRef = inspectionRef.current || inspection;
    const updatedItems = (currentRef.checklist_items || []).map((item: ChecklistItem) => {
      const photoIndex = (item.photos || []).findIndex((p: string) => p === originalUri);
      if (photoIndex !== -1) {
        const newPhotos = [...(item.photos || [])];
        newPhotos[photoIndex] = newUri;
        return { ...item, photos: newPhotos };
      }
      return item;
    });
    const updatedInspection = { ...inspection, checklist_items: updatedItems };
    inspectionRef.current = updatedInspection;
    setInspection(updatedInspection);
    
    // 更新额外条码项的照片
    const updatedExtraBarcode = barcodeItems.map(item => {
      const photoIndex = (item.photos || []).findIndex((p: string) => p === originalUri);
      if (photoIndex !== -1) {
        const newPhotos = [...(item.photos || [])];
        newPhotos[photoIndex] = newUri;
        return { ...item, photos: newPhotos };
      }
      return item;
    });
    setBarcodeItems(updatedExtraBarcode);
    
    // 如果是问题描述的照片，直接更新
    if (editingPhoto?.issueIndex !== undefined && editingPhoto?.photoIndex !== undefined) {
      const newIssues = [...issues];
      if (newIssues[editingPhoto.issueIndex]) {
        newIssues[editingPhoto.issueIndex].photos[editingPhoto.photoIndex] = newUri;
        setIssues(newIssues);
      }
    }
    
    setEditingPhoto(null);
    setCameraVisible(false);
  };

  const fetchInspection = async () => {
    if (!id) return;
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/inspections/${id}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        
        // 打印API返回的原始数据，用于调试
        console.log('[API_RESPONSE] Full response:', JSON.stringify(data).substring(0, 500));
        
        // 优先使用 API 返回的 checklist_items 格式（已处理好的数据）
        // 如果没有，则尝试转换 inspection_records（兼容旧格式）
        const rawItems = data.checklist_items || data.inspection_records || [];
        console.log('[DEBUG] rawItems count:', rawItems.length);
        if (rawItems.length > 0) {
          console.log('[DEBUG] First item keys:', Object.keys(rawItems[0]).join(', '));
          console.log('[DEBUG] First item photos:', JSON.stringify(rawItems[0].photos || rawItems[0].photo_urls));
          console.log('[DEBUG] First item barcodeCodes:', JSON.stringify(rawItems[0].barcodeCodes || rawItems[0].barcode_codes));
        }
        const checklistItems = Array.isArray(rawItems) && rawItems.length > 0
          ? rawItems.map((record: any, index: number) => {
              // item.id 是检查项模板的ID（如151）
              // item.record_id 是 inspection_records 表中的实际记录ID（如344）
              const itemId = parseInt(record.checklist_item_id || record.id || index, 10);
              const itemRecordId = parseInt(record.record_id || record.id || index, 10);
              const item = {
                id: isNaN(itemId) ? index : itemId,
                record_id: isNaN(itemRecordId) ? index : itemRecordId,
                name: record.name || record.item_name || t('unnamed'),
                description: record.description || '',
                category: record.category || record.item_category || t('other'),
                status: record.status || record.result || 'unchecked',
                notes: record.notes,
                photos: record.photos || record.photo_urls || [],
                barcodeCodes: record.barcodeCodes || record.barcode_codes || [],
              };
              console.log('[DEBUG] Mapped item:', item.name, 'id:', item.id, 'record_id:', item.record_id);
              return item;
            })
          : [];
        
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
      Alert.alert(t('error'), t('getDetailFailed'));
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInspection();
    }, [id])
  );

  // 自动同步本地照片到服务器（已完成的验货自动同步）
  useEffect(() => {
    if (!inspection || !id) {
      console.log('[AutoSync] 未执行: inspection或id为空');
      return;
    }
    
    // 只对已完成的验货自动同步
    if (inspection.status !== 'completed') {
      console.log('[AutoSync] 未执行: 状态不是completed, 当前状态:', inspection.status);
      return;
    }
    
    // 检查是否有本地照片需要同步
    const photosToSync: Array<{ itemRecordId: number; photoUri: string; itemIndex: number; photoIndex: number }> = [];
    (inspection.checklist_items || []).forEach((item: ChecklistItem, itemIndex: number) => {
      (item.photos || []).forEach((photo: string, photoIndex: number) => {
        if (photo.startsWith('file:') || photo.startsWith('content://') || photo.startsWith('ph://')) {
          photosToSync.push({ itemRecordId: item.record_id, photoUri: photo, itemIndex, photoIndex });
        }
      });
    });

    console.log('[AutoSync] 发现本地照片:', photosToSync.length, '张');

    if (photosToSync.length === 0) return;

    // 静默同步，不显示弹窗
    const doSync = async () => {
      if (isSyncingPhotosRef.current) return;
      isSyncingPhotosRef.current = true;
      setIsSyncingPhotos(true);
      const updatedItems = JSON.parse(JSON.stringify(inspection.checklist_items));

      try {
        console.log('[AutoSync] 开始同步...');
        for (let i = 0; i < photosToSync.length; i++) {
          const { itemRecordId, photoUri, itemIndex, photoIndex } = photosToSync[i];
          console.log(`[AutoSync] 同步第 ${i + 1}/${photosToSync.length} 张`);
          const filename = photoUri.split('/').pop() || `photo_${Date.now()}.jpg`;
          const extMatch = /\.(\w+)$/.exec(filename);
          const ext = extMatch ? extMatch[1] : 'jpg';

          const formData = new FormData();
          formData.append('file', {
            uri: photoUri,
            name: filename,
            type: `image/${ext}`,
          } as any);
          formData.append('inspection_id', String(id));
          formData.append('record_id', String(itemRecordId));
          formData.append('category', updatedItems[itemIndex].category || updatedItems[itemIndex].name);
          formData.append('item_name', updatedItems[itemIndex].name);

          const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/inspections/${id}/photos`, {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const result = await response.json();
            const serverUrl = result.data?.photo_url;
            if (serverUrl) {
              updatedItems[itemIndex].photos[photoIndex] = serverUrl;
              await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/inspections/${id}/checklist-items/${itemRecordId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photos: updatedItems[itemIndex].photos }),
              });
            }
          }
        }
        setInspection(prev => prev ? { ...prev, checklist_items: updatedItems } : null);
      } catch (error) {
        console.error('自动同步照片失败:', error);
      } finally {
        isSyncingPhotosRef.current = false;
        setIsSyncingPhotos(false);
      }
    };

    doSync();
  }, [inspection?.id, inspection?.status]);

  // 更新检查项状态
  const updateChecklistItem = async (item: ChecklistItem, status: 'pass' | 'fail' | 'na') => {
    if (!inspection) return;

    // 判断是否是新建的条码扫描项（record_id 是临时生成的 Date.now()）
    const recordIdNum = Number(item.record_id);
    const isNewBarcodeItem = recordIdNum > 1000000000000;
    console.log('[UpdateStatus] record_id:', item.record_id, 'isNew:', isNewBarcodeItem);

    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

      // 如果是新建的条码扫描项，先保存到数据库
      if (isNewBarcodeItem) {
        // 从当前状态中获取最新的检查项数据（包含最新添加的照片）
        const currentInspection = inspectionRef.current;
        const currentItem = currentInspection?.checklist_items.find(
          (i: any) => String(i.record_id) === String(item.record_id)
        );
        const photosToSave = currentItem?.photos || item.photos || [];
        const barcodeCodesToSave = currentItem?.barcodeCodes || item.barcodeCodes || [];
        
        // 保存新建的检查项
        const saveResponse = await fetch(`${baseUrl}/api/v1/inspections/${id}/checklist-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            category: item.category,
            item_category: item.category,
            result: status,
            photos: photosToSave,
            barcode_codes: barcodeCodesToSave,
            barcode_type: item.barcodeType,
          }),
        });

        if (!saveResponse.ok) {
          const errorText = await saveResponse.text();
          console.log('[SaveItem] Error response:', errorText);
          throw new Error('Failed to save new checklist item');
        }

        const saveData = await saveResponse.json();
        console.log('[SaveItem] Success response:', saveData);
        // API 返回格式: { data: { id: 125, ... } } 或 { id: 125, ... }
        const newRecordId = saveData.data?.id || saveData.id;
        if (!newRecordId) {
          console.error('[SaveItem] No record_id in response:', saveData);
          throw new Error('Invalid response: missing id');
        }

        // 更新本地状态，使用真实的 record_id
        const targetRecordId = String(newRecordId);
        const updatedItems = inspection.checklist_items.map(i =>
          String(i.record_id) === String(item.record_id)
            ? { ...i, record_id: newRecordId, status }
            : i
        );

        // 同时更新 barcodeItems
        const updatedBarcodeItems = barcodeItems.map(i =>
          String(i.record_id) === String(item.record_id)
            ? { ...i, record_id: newRecordId, status }
            : i
        );
        setBarcodeItems(updatedBarcodeItems);

        const checkedCount = updatedItems.filter(i => i.status !== 'unchecked').length;
        const defectCount = updatedItems.filter(i => i.status === 'fail').length;

        setInspection({
          ...inspection,
          checklist_items: updatedItems,
          checkedCount,
          defectCount,
        });

        return;
      }

      // 对于嵌入式模板的检查项，使用 record_id 来更新（不是 id）
      // item.record_id 是数据库中的实际记录ID，如344、345等
      // item.id 是检查项模板的ID，如151、146等
      const recordId = item.record_id && item.record_id > 0 ? String(item.record_id) : String(item.id);
      
      // 从当前状态中获取最新的检查项数据（包含最新添加的照片）
      const currentInspection = inspectionRef.current;
      const currentItem = currentInspection?.checklist_items.find(
        (i: any) => String(i.id) === String(item.id)
      );
      let photosToSave = currentItem?.photos || item.photos || [];
      const barcodeCodesToSave = currentItem?.barcodeCodes || item.barcodeCodes || [];
      
      console.log('[PUT_REQUEST] record_id:', recordId, 'item.id:', item.id, 'item.record_id:', item.record_id);
      
      // 如果有本地照片（file:// 开头），需要先上传到服务器获取URL
      const localPhotos = photosToSave.filter((p: string) => typeof p === 'string' && (p.startsWith('file:') || p.startsWith('content:')));
      const serverPhotos = photosToSave.filter((p: string) => typeof p === 'string' && (p.startsWith('http://') || p.startsWith('https://')));
      
      if (localPhotos.length > 0) {
        console.log('[PUT_REQUEST] Uploading', localPhotos.length, 'local photos to server...');
        const uploadedUrls: string[] = [];
        
        for (const localUri of localPhotos) {
          try {
            const formData = new FormData();
            const filename = localUri.split('/').pop() || `photo_${Date.now()}.jpg`;
            formData.append('file', {
              uri: localUri,
              type: 'image/jpeg',
              name: filename,
            } as any);
            formData.append('inspection_id', String(id));
            formData.append('record_id', recordId);
            formData.append('category', item.category || '');
            formData.append('item_name', item.name);
            
            const uploadResponse = await fetch(`${baseUrl}/api/v1/inspections/${id}/photos`, {
              method: 'POST',
              body: formData,
            });
            
            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              const photoUrl = uploadData.data?.photo_url || uploadData.photo_url;
              if (photoUrl) {
                uploadedUrls.push(photoUrl);
                console.log('[PUT_REQUEST] Uploaded photo URL:', photoUrl);
              }
            }
          } catch (uploadError) {
            console.error('[PUT_REQUEST] Failed to upload photo:', uploadError);
          }
        }
        
        // 合并服务器照片和之前已有的照片URL
        photosToSave = [...serverPhotos, ...uploadedUrls];
      }
      
      // 调试日志 - 显示要发送的数据
      console.log('[PUT_REQUEST] Sending to API:', {
        url: `${baseUrl}/api/v1/inspections/${id}/records/${recordId}`,
        body: {
          result: status,
          photos: photosToSave,
          barcode_codes: barcodeCodesToSave,
        }
      });
      
      // 更新状态时，同时保存照片和条码数据
      const response = await fetch(`${baseUrl}/api/v1/inspections/${id}/records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          result: status,
          photos: photosToSave,
          barcode_codes: barcodeCodesToSave,
        }),
      });
      
      // 调试日志 - 显示API响应
      if (response.ok) {
        const responseData = await response.json();
        console.log('[PUT_RESPONSE] Success:', JSON.stringify(responseData).substring(0, 300));
      } else {
        console.log('[PUT_RESPONSE] Error:', response.status);
      }

      if (response.ok) {
        // 更新本地状态 - 使用 id 字符串比较确保类型一致
        const targetId = String(item.id);
        const updatedItems = inspection.checklist_items.map(i =>
          String(i.id) === targetId ? { ...i, status } : i
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
        Alert.alert(t('error'), t('updateFailed'));
      }
    } catch (error) {
      console.error('Failed to update checklist item:', error);
    }
  };

  // 拍照功能 - 打开相机页面
  const takePhoto = (item?: ChecklistItem) => {
    const targetItem = item || selectedItem;
    if (!targetItem) return;
    
    console.log('[takePhoto] Called with item record_id:', targetItem.record_id, 'photos:', targetItem.photos);
    
    // 设置临时目标
    setTempPhotoTarget(targetItem);
    // 将之前保存的照片（从服务器加载的）加载到临时预览区
    const previousPhotos = (targetItem.photos || []).filter((p: string) => 
      p && (p.startsWith('http://') || p.startsWith('https://'))
    );
    console.log('[takePhoto] previousPhotos:', previousPhotos);
    setTempPhotos(previousPhotos);
    // 打开相机
    setCameraVisible(true);
  };

  // 完成拍照 - 将临时照片保存到清单项并上传到服务器
  const handleCompletePhotos = async () => {
    if (!tempPhotoTarget || tempPhotos.length === 0) {
      // 如果没有照片，清除状态
      setTempPhotoTarget(null);
      setTempPhotos([]);
      return;
    }
    
    // 确保 record_id 正确（使用 record_id 而不是 id）
    const targetRecordId = tempPhotoTarget.record_id && tempPhotoTarget.record_id > 0 
      ? String(tempPhotoTarget.record_id) 
      : String(tempPhotoTarget.id);
    
    // 添加超时包装的 fetch
    const fetchWithTimeout = async (url: string, options: any, timeout = 15000): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.log('[CompletePhotos] Upload timeout');
          throw new Error('Upload timeout');
        }
        throw error;
      }
    };

    // 先上传所有照片到服务器
    const uploadedUrls: string[] = [];
    for (const photoUri of tempPhotos) {
      try {
        console.log('[CompletePhotos] Uploading photo:', photoUri);
        const filename = photoUri.split("/").pop() || `photo_${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1] : "jpg";
        const formData = new FormData();
        formData.append("file", {
          uri: photoUri,
          name: filename,
          type: `image/${ext}`,
        } as any);
        formData.append("inspection_id", String(id));
        formData.append("record_id", targetRecordId);
        formData.append("category", tempPhotoTarget.category || tempPhotoTarget.name);
        formData.append("item_name", tempPhotoTarget.name);
        
        const uploadResponse = await fetchWithTimeout(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/inspections/${id}/photos`, {
          method: "POST",
          body: formData,
        });
        
        if (uploadResponse.ok) {
          const result = await uploadResponse.json();
          // 后端返回的字段名是 photo_url
          const photoUrl = result.data?.photo_url || result.data?.photoUrl || result.photoUrl;
          if (photoUrl) {
            uploadedUrls.push(photoUrl);
            console.log('[CompletePhotos] Uploaded:', photoUrl);
          }
        } else {
          console.log('[CompletePhotos] Upload failed:', uploadResponse.status);
        }
      } catch (error) {
        console.error('[CompletePhotos] Upload error:', error);
      }
    }
    
    console.log('[CompletePhotos] All uploaded URLs:', uploadedUrls);
    
    // 获取之前的照片（从服务器加载的，http/https 开头的），过滤掉本地 URI
    const previousPhotos = (tempPhotoTarget.photos || []).filter((p: string) => 
      p && (p.startsWith('http://') || p.startsWith('https://'))
    );
    
    // 如果有新上传的照片，用服务器 URL 替换本地路径
    let allPhotos: string[];
    if (uploadedUrls.length > 0) {
      // 有服务器 URL，使用服务器 URL
      allPhotos = [...previousPhotos, ...uploadedUrls];
      console.log('[CompletePhotos] Using server URLs:', allPhotos);
    } else if (tempPhotos.length > 0) {
      // 上传全部失败，保留本地路径（用于调试，但这些路径可能失效）
      console.log('[CompletePhotos] Upload failed, keeping local paths');
      allPhotos = tempPhotos;
    } else {
      allPhotos = previousPhotos;
    }
    console.log('[CompletePhotos] Previous photos:', previousPhotos, 'All photos:', allPhotos);
    
    // 将照片URL保存到清单项（用于前端显示）
    const updatedItems = inspection?.checklist_items.map(i =>
      String(i.record_id) === targetRecordId
        ? { ...i, photos: allPhotos }
        : i
    );
    
    // 同时更新inspection_records表的photos字段
    let realRecordId: string | null = null;
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      
      // 检查是否是新建条码项（record_id > 1000000000000 表示 Date.now()）
      const isNewBarcodeItem = tempPhotoTarget.record_id && tempPhotoTarget.record_id > 1000000000000;
      
      // 保存照片前的 recordId
      let saveRecordId: string;
      
      if (isNewBarcodeItem) {
        // 对于新建条码项，先 POST 创建记录
        console.log('[CompletePhotos] Creating new record for barcode item');
        const createResponse = await fetch(`${baseUrl}/api/v1/inspections/${id}/checklist-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tempPhotoTarget.name,
            category: tempPhotoTarget.category,
            item_category: tempPhotoTarget.category,
            result: 'pass',
            photos: allPhotos,
            barcode_codes: tempPhotoTarget.barcodeCodes || [],
            barcode_type: tempPhotoTarget.barcodeType,
          }),
        });
        
        if (createResponse.ok) {
          const createData = await createResponse.json();
          realRecordId = String(createData.data?.id || createData.id);
          saveRecordId = realRecordId;
          console.log('[CompletePhotos] Created new record with id:', realRecordId);
          
          // 更新前端状态中的 record_id
          const tempTargetRecordId = String(tempPhotoTarget.record_id || tempPhotoTarget.id);
          
          // 更新 inspection.checklist_items 中的 record_id
          setInspection(prev => {
            if (!prev) return null;
            return {
              ...prev,
              checklist_items: prev.checklist_items.map(i =>
                String(i.record_id) === tempTargetRecordId
                  ? { ...i, record_id: parseInt(realRecordId!) }
                  : i
              )
            };
          });
          
          // 更新 barcodeItems 中的 record_id
          setBarcodeItems(prev => prev.map(i =>
            String(i.record_id) === tempTargetRecordId
              ? { ...i, record_id: parseInt(realRecordId!) }
              : i
          ));
        } else {
          console.log('[CompletePhotos] Create record failed:', createResponse.status);
          // 如果创建失败，跳过保存
          setTempPhotoTarget(null);
          setTempPhotos([]);
          return;
        }
      } else {
        // 对于已有记录，直接使用 record_id
        saveRecordId = tempPhotoTarget.record_id && tempPhotoTarget.record_id > 0 
          ? String(tempPhotoTarget.record_id) 
          : String(tempPhotoTarget.id);
      }
      
      console.log('[CompletePhotos] Saving with recordId:', saveRecordId, 'isNew:', isNewBarcodeItem);
      
      const saveResponse = await fetch(`${baseUrl}/api/v1/inspections/${id}/records/${saveRecordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          result: 'pass',
          photos: allPhotos,
        }),
      });
      
      if (saveResponse.ok) {
        const resultData = await saveResponse.json();
        console.log('[CompletePhotos] Saved photos to inspection_records:', resultData);
      } else {
        console.log('[CompletePhotos] Save failed:', saveResponse.status);
      }
    } catch (error) {
      console.error('[CompletePhotos] Failed to save photos:', error);
    }
    
    // 更新检查状态为已检查
    const updatedItemsWithStatus = updatedItems?.map(i =>
      String(i.record_id) === targetRecordId
        ? { ...i, status: 'pass' as const }
        : i
    );
    
    setInspection(prev => prev ? { ...prev, checklist_items: updatedItemsWithStatus || [] } : null);
    
    // 同时更新 barcodeItems 状态，确保条码检查项的照片能显示
    if (tempPhotoTarget) {
      const targetRecordId = String(tempPhotoTarget.record_id || tempPhotoTarget.id);
      console.log('[CompletePhotos] Updating barcodeItems - targetRecordId:', targetRecordId);
      console.log('[CompletePhotos] allPhotos to set:', allPhotos);
      setBarcodeItems(prev => {
        console.log('[CompletePhotos] Current barcodeItems count:', prev.length);
        const updated = prev.map(item => {
          const itemRecordId = String(item.record_id || item.id);
          console.log('[CompletePhotos] Comparing itemRecordId:', itemRecordId, 'with target:', targetRecordId, 'match:', itemRecordId === targetRecordId);
          if (itemRecordId === targetRecordId) {
            return { ...item, photos: allPhotos };
          }
          return item;
        });
        console.log('[CompletePhotos] Updated barcodeItems photos:', updated.find(i => String(i.record_id || i.id) === targetRecordId)?.photos);
        return updated;
      });
    }
    
    // 清除临时状态
    setTempPhotoTarget(null);
    setTempPhotos([]);
  };

  // 添加缺陷
  const handleAddDefect = async () => {
    if (!selectedItem || !defectForm.description.trim()) {
      Alert.alert(t('tip'), t('pleaseFillDefectDescription'));
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

  // 合格提交验货
  const handleSubmitPass = async () => {
    if (!inspection) return;

    const uncheckedCount = inspection.checklist_items.filter(i => i.status === 'unchecked').length;
    if (uncheckedCount > 0) {
      Alert.alert(t('tip'), `${uncheckedCount} ${t('itemsUnchecked')} ${t('submitPassConfirm')}`, [
        { text: t('cancel'), style: 'cancel' },
        { text: t('confirm'), onPress: () => doSubmit('pass') },
      ]);
    } else {
      Alert.alert(t('tip'), t('submitPassConfirm'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('confirm'), onPress: () => doSubmit('pass') },
      ]);
    }
  };

  // 不合格提交验货
  const handleSubmitFail = async () => {
    if (!inspection) return;

    Alert.alert(t('tip'), t('submitFailConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), onPress: () => doSubmit('fail') },
    ]);
  };

  // 导出验货照片（支持Web和移动端）
  const handleExportPhotos = async () => {
    if (!inspection) {
      Alert.alert('错误', '验货数据不存在');
      return;
    }

    const serverBaseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
    if (!serverBaseUrl) {
      Alert.alert('错误', '服务器地址未配置');
      return;
    }

    const allPhotos: string[] = [];
    const photoMap: { [key: string]: string } = {};
    
    (inspection.checklist_items || []).forEach((item: any) => {
      if (item.photos && item.photos.length > 0) {
        item.photos.forEach((photo: string) => {
          if (!photoMap[photo]) {
            photoMap[photo] = item.name || item.category || '未知';
            allPhotos.push(photo);
          }
        });
      }
    });

    if (inspection.defects && inspection.defects.length > 0) {
      inspection.defects.forEach((defect: any) => {
        if (defect.photos && defect.photos.length > 0) {
          defect.photos.forEach((photo: string) => {
            if (!photoMap[photo]) {
              photoMap[photo] = '缺陷记录';
              allPhotos.push(photo);
            }
          });
        }
      });
    }

    if (allPhotos.length === 0) {
      Alert.alert('提示', '暂无照片可导出');
      return;
    }

    console.log(`[Export] 找到 ${allPhotos.length} 张照片待导出`);

    // Web端下载
    if (Platform.OS === 'web') {
      Alert.alert('导出照片', `正在导出 ${allPhotos.length} 张照片，请在浏览器中允许下载...`);
      
      let successCount = 0;
      for (let i = 0; i < allPhotos.length; i++) {
        const photo = allPhotos[i];
        try {
          const photoUrl = photo.startsWith('/') 
            ? `${serverBaseUrl}${photo}` 
            : `${serverBaseUrl}/${photo}`;
          
          console.log(`[Export] (Web) 下载第 ${i+1}/${allPhotos.length}: ${photoUrl}`);
          
          const response = await fetch(photoUrl);
          const blob = await response.blob();
          
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const filename = photo.split('/').pop() || `inspection_${Date.now()}_${i}.jpg`;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          successCount++;
          console.log(`[Export] (Web) 第 ${i+1} 张下载成功`);
        } catch (err) {
          console.error(`[Export] (Web) 第 ${i+1} 张下载失败:`, err);
        }
      }

      if (successCount > 0) {
        Alert.alert('导出完成', `已触发下载 ${successCount} 张照片`);
      } else {
        Alert.alert('导出失败', '请检查网络连接后重试');
      }
      return;
    }

    // 移动端：保存到相册
    try {
      console.log('[Export] 开始导出照片到相册...');
      let permissionResult;
      
      // 首先检查当前权限状态
      try {
        const currentPermission = await MediaLibrary.getPermissionsAsync();
        console.log('[Export] 当前权限状态:', JSON.stringify(currentPermission));
        
        if (!currentPermission.granted) {
          // 请求写入相册的权限
          permissionResult = await MediaLibrary.requestPermissionsAsync();
          console.log('[Export] 请求后的权限状态:', JSON.stringify(permissionResult));
        } else {
          permissionResult = currentPermission;
        }
      } catch (permError) {
        console.error('[Export] 权限检查出错:', permError);
        // 尝试直接请求权限
        try {
          permissionResult = await MediaLibrary.requestPermissionsAsync();
        } catch (reqError) {
          console.error('[Export] 请求权限失败:', reqError);
          Alert.alert('导出失败', '无法获取相册访问权限，请检查应用权限设置');
          return;
        }
      }
      
      if (!permissionResult?.granted) {
        console.log('[Export] 权限未授权:', permissionResult);
        Alert.alert('提示', '需要相册权限才能保存照片，请在手机设置中开启相册访问权限');
        return;
      }

      Alert.alert('导出照片', `正在导出 ${allPhotos.length} 张照片，请稍候...`);

      let successCount = 0;
      let failCount = 0;
      const FileSystemAny = FileSystem as any;

      for (let i = 0; i < allPhotos.length; i++) {
        const photo = allPhotos[i];
        try {
          // 使用后端代理下载照片，避免跨域和认证问题
          let originalPhotoUrl: string;
          if (photo.startsWith('http')) {
            originalPhotoUrl = photo;
          } else {
            // 如果是相对路径，构建完整URL
            originalPhotoUrl = photo.startsWith('/') 
              ? `${serverBaseUrl}${photo}` 
              : `${serverBaseUrl}/${photo}`;
          }
          
          // 通过后端代理下载
          const encodedUrl = encodeURIComponent(originalPhotoUrl);
          const photoUrl = `${serverBaseUrl}/api/v1/photos/download?url=${encodedUrl}`;
          
          console.log(`[Export] (Mobile) 下载第 ${i+1}/${allPhotos.length}: ${photoUrl}`);
          
          // 生成合适的文件名
          const timestamp = Date.now();
          const filename = `inspection_${timestamp}_${i + 1}.jpg`;
          const localFileUri = `${FileSystemAny.cacheDirectory}${filename}`;

          const downloadResult = await FileSystemAny.downloadAsync(photoUrl, localFileUri);
          console.log(`[Export] 下载状态: ${downloadResult.status}, URI: ${downloadResult.uri}`);
          
          if (downloadResult.status === 200) {
            // 确保 URI 格式正确，MediaLibrary.createAssetAsync 需要 file:// 前缀
            let assetUri = downloadResult.uri;
            if (!assetUri.startsWith('file://')) {
              assetUri = `file://${assetUri}`;
            }
            try {
              const asset = await MediaLibrary.createAssetAsync(assetUri);
              console.log(`[Export] (Mobile) 第 ${i+1} 张保存成功, asset:`, asset);
              successCount++;
              
              try {
                await FileSystemAny.deleteAsync(localFileUri);
              } catch (cleanupError) {
                console.log('[Export] 清理缓存失败:', cleanupError);
              }
            } catch (assetError) {
              console.error(`[Export] (Mobile) 保存到相册失败:`, assetError);
              const errorMessage = assetError instanceof Error ? assetError.message : '未知错误';
              Alert.alert('导出失败', `保存照片时出错: ${errorMessage}`);
              return; // 发生错误时直接返回，不再继续
            }
          } else {
            console.error(`[Export] (Mobile) 第 ${i+1} 张下载失败: HTTP ${downloadResult.status}`);
            failCount++;
          }
        } catch (err) {
          console.error(`[Export] (Mobile) 第 ${i+1} 张失败:`, err);
          failCount++;
        }
        
        if (i < allPhotos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      console.log(`[Export] 导出完成: 成功 ${successCount}, 失败 ${failCount}`);
      
      if (successCount > 0) {
        Alert.alert('导出完成', `成功保存 ${successCount} 张照片${failCount > 0 ? `，${failCount} 张失败` : ''}`);
      } else if (failCount > 0) {
        Alert.alert('导出失败', '照片保存失败，请检查网络连接后重试');
      } else {
        Alert.alert('提示', '没有照片需要导出');
      }
    } catch (error) {
      console.error('[Export] 导出照片失败:', error);
      Alert.alert('导出失败', `保存照片时出错`);
    }
  };

  // 导出验货报告为 PDF（调用后端 API 直接下载）
  const handleExportReport = async () => {
    if (!inspection) return;

    try {
      setExportingReport(true);

      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const pdfUrl = `${baseUrl}/api/v1/inspections/${id}/export-pdf`;

      console.log('[Export] Downloading PDF from:', pdfUrl);

      // 使用 fetch 下载 PDF
      const response = await fetch(pdfUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // 获取 PDF 文件
      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error('PDF file is empty');
      }

      console.log('[Export] PDF downloaded, size:', blob.size);

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `验货报告_${inspection.inspection_number || id}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match) {
          filename = match[1].replace(/['"]/g, '');
        }
      }

      // 保存文件
      const FileSystemAny = FileSystem as any;
      const fileUri = `${FileSystemAny.documentDirectory}${filename}`;

      // 将 blob 转换为 base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // 去掉 data:...;base64, 前缀
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      // 写入文件
      await FileSystemAny.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystemAny.EncodingType ? FileSystemAny.EncodingType.Base64 : 'base64'
      });

      console.log('[Export] PDF saved to:', fileUri);

      // 使用 expo-sharing 分享
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: '导出验货报告',
          UTI: 'com.adobe.pdf'
        });
        console.log('[Export] Share dialog opened');
      } else {
        Alert.alert('导出成功', `报告已保存到: ${filename}`);
      }

    } catch (error: any) {
      console.error('[Export] Export PDF error:', error);
      Alert.alert('错误', `导出报告失败: ${error?.message || '请重试'}`);
    } finally {
      setExportingReport(false);
    }
  };

  const doSubmit = async (result: 'pass' | 'fail') => {
    try {
      // 先上传所有本地照片到服务器
      if (inspection?.checklist_items) {
        const allLocalPhotos: { recordId: number; localPath: string }[] = [];
        
        // 收集所有本地路径照片
        inspection.checklist_items.forEach(item => {
          if (item.photos && item.photos.length > 0) {
            item.photos.forEach((photo: string) => {
              if (photo.startsWith('file:') || photo.startsWith('content:')) {
                allLocalPhotos.push({ recordId: item.id, localPath: photo });
              }
            });
          }
        });

        // 上传本地照片
        if (allLocalPhotos.length > 0) {
          // 显示上传提示
          Alert.alert(t('uploading'), `${t('uploadingPhotos')} ${allLocalPhotos.length} ${t('count')}`);
          
          const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
          const uploadedPhotos: { [recordId: number]: string[] } = {};
          
          for (const { recordId, localPath } of allLocalPhotos) {
            try {
              // 检查文件是否存在
              const FileSystemAny = FileSystem as any;
              const fileInfo = await FileSystemAny.getInfoAsync(localPath);
              if (!fileInfo.exists) {
                console.log('[doSubmit] File not found:', localPath);
                continue;
              }
              
              // 获取文件名
              const filename = localPath.split('/').pop() || `photo_${Date.now()}.jpg`;
              
              // 创建 FormData
              const formData = new FormData();
              formData.append('file', {
                uri: localPath,
                name: filename,
                type: 'image/jpeg',
              } as any);
              formData.append('recordId', String(recordId));
              
              // 上传到服务器 - 使用正确的API路径
              const uploadRes = await fetch(`${baseUrl}/api/v1/inspections/${id}/photos`, {
                method: 'POST',
                body: formData,
              });
              
              if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                // 服务器返回的路径可能是完整的URL或相对路径
                let serverPath = uploadData.photo_url || uploadData.url || uploadData.path;
                
                // 如果返回的是相对路径，补全为完整路径
                if (serverPath && !serverPath.startsWith('http') && !serverPath.startsWith('/uploads')) {
                  serverPath = `/uploads/photos/${serverPath}`;
                }
                
                console.log('[doSubmit] Upload success:', serverPath);
                
                // 收集上传成功的照片
                if (!uploadedPhotos[recordId]) {
                  uploadedPhotos[recordId] = [];
                }
                uploadedPhotos[recordId].push(serverPath);
              } else {
                console.error('[doSubmit] Upload failed, status:', uploadRes.status);
              }
            } catch (uploadError) {
              console.error('[doSubmit] Upload error:', uploadError);
            }
          }
          
          // 更新数据库中的照片路径
          for (const [recordId, serverPaths] of Object.entries(uploadedPhotos)) {
            if (serverPaths.length > 0) {
              const item = inspection.checklist_items.find(i => i.id === Number(recordId));
              if (item && item.photos) {
                // 合并服务器路径和本地路径
                const updatedPhotos = [...item.photos];
                serverPaths.forEach(serverPath => {
                  // 移除对应的本地路径，添加服务器路径
                  const localIndex = updatedPhotos.findIndex(p => 
                    p.startsWith('file:') || p.startsWith('content:')
                  );
                  if (localIndex !== -1) {
                    updatedPhotos.splice(localIndex, 1, serverPath);
                  }
                });
                
                // 更新到服务器
                await fetch(`${baseUrl}/api/v1/inspections/${id}/checklist-items/${recordId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ photos: updatedPhotos }),
                });
              }
            }
          }
        }
      }

      // 提交验货结果
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/inspections/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });

      const successMsg = result === 'pass' ? t('submitPassSuccess') : t('submitFailSuccess');
      if (response.ok) {
        Alert.alert(t('success'), successMsg, [
          { text: t('ok'), onPress: () => router.navigate('/records') },
        ]);
      } else {
        Alert.alert(t('error'), t('submitFailed'));
      }
    } catch (error) {
      console.error('Failed to submit:', error);
      Alert.alert(t('error'), t('submitFailed'));
    }
  };

  // 打开条码扫码
  const openBarcodeScanner = (item: ChecklistItem) => {
    setBarcodeScanTarget(item);
    setBarcodeScannerVisible(true);
    setShowBarcodeCamera(true);
    setHasScannedBarcode(false);
    isScanningRef.current = false;
  };

  // 处理条码扫描结果
  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    // 使用 ref 检查，避免异步状态更新导致的问题
    if (!result.data || !barcodeScanTarget || isScanningRef.current) return;
    
    // 立即标记为已扫描，防止重复触发
    isScanningRef.current = true;
    
    // 关闭扫码 Modal，直接返回预览区
    setBarcodeScannerVisible(false);
    setBarcodeScanTarget(null);
    
    // 将扫描到的条码添加到对应检查项
    const targetRecordId = String(barcodeScanTarget.record_id);
    const scannedCode = result.data;
    
    // 更新 inspection.checklist_items
    setInspection(prev => {
      if (!prev) return null;
      const updatedItems = prev.checklist_items.map(i =>
        String(i.record_id) === targetRecordId
          ? { ...i, barcodeCodes: [...(i.barcodeCodes || []), scannedCode] }
          : i
      );
      const checkedCount = updatedItems.filter(i => i.status !== 'unchecked').length;
      const defectCount = updatedItems.filter(i => i.status === 'fail').length;
      return { ...prev, checklist_items: updatedItems, checkedCount, defectCount };
    });
    
    // 同时更新 barcodeItems，确保预览区能显示
    setBarcodeItems(prev => {
      const targetIndex = prev.findIndex(item => String(item.record_id) === targetRecordId);
      if (targetIndex === -1) {
        // 如果在 barcodeItems 中没找到，创建新项（不自动设置合格）
        const newItem = { ...barcodeScanTarget, barcodeCodes: [scannedCode], photos: [], status: 'unchecked' as const, type: 'barcode' as const };
        console.log('[BarcodeScan] Creating new item:', newItem);
        return [...prev, newItem];
      }
      const updated = [...prev];
      updated[targetIndex] = {
        ...updated[targetIndex],
        barcodeCodes: [...(updated[targetIndex].barcodeCodes || []), scannedCode],
        // 不自动设置合格，保持原状态
      };
      console.log('[BarcodeScan] Updated barcodeItems index:', targetIndex, 'codes:', updated[targetIndex].barcodeCodes);
      return updated;
    });
    
    // 关闭相机预览，只显示结果
    if (barcodeCameraRef.current) {
      barcodeCameraRef.current.pausePreview();
    }

    // 保存条码到数据库
    saveBarcodeToBackend(targetRecordId, scannedCode);
  };

  // 保存条码到后端
  const saveBarcodeToBackend = async (recordId: string, code: string) => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      // 获取当前条码列表
      const item = inspection?.checklist_items?.find(i => String(i.record_id) === recordId);
      const currentCodes = item?.barcodeCodes || [];
      
      const response = await fetch(`${baseUrl}/api/v1/inspections/${id}/checklist-items/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcodeCodes: [...currentCodes, code] }),
      });
      
      if (!response.ok) {
        console.error('[SaveBarcode] Failed to save barcode:', response.statusText);
      }
    } catch (error) {
      console.error('[SaveBarcode] Error:', error);
    }
  };

  // 删除单个条码
  const handleDeleteBarcodeCode = async (itemId: number, codeToDelete: string) => {
    const item = inspection?.checklist_items?.find(i => i.id === itemId);
    if (!item) return;
    
    const newCodes = item.barcodeCodes?.filter(c => c !== codeToDelete) || [];
    
    // 乐观更新：先更新本地状态，立即显示效果
    setInspection(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        checklist_items: prev.checklist_items?.map(i => 
          i.id === itemId ? { ...i, barcodeCodes: newCodes } : i
        ),
      };
    });
    
    try {
      console.log("[BarcodeDelete] Deleting barcode:", itemId, codeToDelete, "newCodes:", newCodes);
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/inspections/${id}/checklist-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcodeCodes: newCodes }),
      });
      
      console.log("[BarcodeDelete] Response:", response.status, response.statusText);
    } catch (error) {
      console.error('[BarcodeDelete] Delete barcode error:', error);
    }
  };

  // 完成条码扫描，跳转到检查项目页面
  const finishBarcodeScan = () => {
    closeBarcodeScanner();
    // 滚动到检查项目区域
    // 这里假设跳转到对应的分类检查项
    const categories = inspection?.checklist_items.map(item => item.category) || [];
    const barcodeCategoryIndex = categories.indexOf('条码扫描以及拍照');
    if (barcodeCategoryIndex > -1) {
      // 可以通过ref或者FlatList的scrollToIndex来滚动
    }
  };

  // 关闭条码扫码
  const closeBarcodeScanner = () => {
    setBarcodeScannerVisible(false);
    setBarcodeScanTarget(null);
    setHasScannedBarcode(false);
    setShowBarcodeCamera(false);
    isScanningRef.current = false;
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

  // 调试：显示所有有照片的检查项
  const itemsWithPhotos = inspection.checklist_items.filter(item => item.photos && item.photos.length > 0);
  if (itemsWithPhotos.length > 0) {
    console.log('[DEBUG] Items with photos:', itemsWithPhotos.map(i => ({ name: i.name, photos: i.photos })));
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
      {cameraVisible && (tempPhotoTarget || editingPhoto) && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
          <CustomCamera
          visible={cameraVisible}
          onClose={() => {
            setCameraVisible(false);
            setEditingPhoto(null);
          }}
          editingPhotoUri={editingPhoto ? getImageUrl(editingPhoto.uri) : undefined}
          onUpdatePhoto={handleUpdatePhoto}
          onComplete={async (photos) => {
            // 如果是编辑模式且没有新拍的照片，只关闭相机
            if (editingPhoto && photos.length === 0) {
              setCameraVisible(false);
              setEditingPhoto(null);
              return;
            }
            
            // 如果没有新照片且不是编辑模式，提示用户
            if (photos.length === 0) {
              return;
            }
            
            const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
            const photoUris = photos.map(p => p.uri);
            const targetRecordId = tempPhotoTarget?.record_id;
            const targetIssueIndex = tempPhotoTarget?.issueIndex;
            
            // 处理问题描述照片 - 如果是在编辑问题照片时拍了新照片，替换原照片
            if (editingPhoto?.issueIndex !== undefined) {
              const newIssues = [...issues];
              if (photos.length > 0) {
                // 新拍的照片添加到问题描述
                newIssues[editingPhoto.issueIndex].photos.push(...photoUris);
              }
              setIssues(newIssues);
              setCameraVisible(false);
              setEditingPhoto(null);
              return;
            }
            
            // 如果没有目标 record_id，不处理
            if (!targetRecordId) {
              return;
            }
            
            // 将照片添加到本地状态
            const currentInspection = inspectionRef.current;
            if (!currentInspection) return;
            
            const updatedItems = currentInspection.checklist_items.map(item => {
              if (item.record_id === targetRecordId) {
                return { ...item, photos: [...(item.photos || []), ...photoUris] };
              }
              return item;
            });
            setInspection(prev => prev ? { ...prev, checklist_items: updatedItems } : null);
            
            // 同步更新 barcodeItems 状态，确保条码检查项的照片能显示
            const targetRecordIdStr = String(targetRecordId);
            // 合并之前已上传的照片URL（http/https开头）和新拍的照片
            const previousUploadedPhotos = (tempPhotoTarget?.photos || []).filter((p: string) => 
              p && (p.startsWith('http://') || p.startsWith('https://'))
            );
            const newPhotos = [...previousUploadedPhotos, ...photoUris];
            setBarcodeItems(prev => prev.map(item => {
              const itemRecordIdStr = String(item.record_id || item.id);
              if (itemRecordIdStr === targetRecordIdStr) {
                return { ...item, photos: newPhotos };
              }
              return item;
            }));
            
            // 同步更新 tempPhotos 状态，让预览区能显示照片
            setTempPhotos(prev => [...prev, ...photoUris]);
            
            // 上传照片到服务器（先压缩为1600x1200@96DPI, 90%质量）
            try {
              for (let i = 0; i < photos.length; i++) {
                const photo = photos[i];
                
                // 压缩照片：1600x1200像素, 90% JPEG质量
                const manipulatedImage = await ImageManipulator.manipulateAsync(
                  photo.uri,
                  [{ resize: { width: 1600, height: 1200 } }],
                  { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
                );
                
                const filename = `photo_${Date.now()}_${i}.jpg`;
                const fileObj = await createFormDataFile(manipulatedImage.uri, filename, 'image/jpeg');
                
                const formData = new FormData();
                formData.append('record_id', String(targetRecordId));
                formData.append('file', fileObj as any);
                
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
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="chevron-left" size={24} color="#2D3436" />
            </TouchableOpacity>
            <View style={styles.headerMain}>
              {/* 订单号 */}
              {inspection.batch_number && (
                <Text style={styles.orderNumber}>{inspection.batch_number}</Text>
              )}
              {/* 供应商 */}
              <Text style={styles.supplierName}>供应商 / Supplier</Text>
              <Text style={styles.supplierNameValue}>{inspection.supplier_name}</Text>
            </View>
            <View style={[styles.statusBadge, {
              backgroundColor: inspection.status === 'completed' ? 'rgba(0,184,148,0.15)' : 'rgba(14,165,233,0.15)'
            }]}>
              <Text style={[styles.statusText, { color: inspection.status === 'completed' ? '#00B894' : '#0EA5E9' }]}>
                {inspection.status === 'pending' ? '待验货 / Pending' : inspection.status === 'in_progress' ? '进行中 / In Progress' : '已完成 / Completed'}
              </Text>
            </View>
          </View>

          {/* 基本信息 - 订单信息区域 */}
          <View style={styles.basicInfoGrid}>
            {/* 订单号 */}
            {inspection.order_number && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>订单号 / Order No.</Text>
                <Text style={styles.basicInfoValue}>{inspection.order_number}</Text>
              </View>
            )}
            {/* 货号 */}
            {inspection.style_number && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>货号 / Style No.</Text>
                <Text style={styles.basicInfoValue}>{inspection.style_number}</Text>
              </View>
            )}
            {/* 产品名称 */}
            {inspection.product_name && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>产品名称 / Product</Text>
                <Text style={styles.basicInfoValue}>{inspection.product_name}</Text>
              </View>
            )}
            {/* 产品数量 */}
            {inspection.quantity && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>产品数量 / Quantity</Text>
                <Text style={styles.basicInfoValue}>{inspection.quantity}</Text>
              </View>
            )}
            {/* 抽样数量（包含允收数、拒收数） */}
            {inspection.sample_size && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>抽样数量 / Sample Qty</Text>
                <Text style={styles.basicInfoValue}>{inspection.sample_size}</Text>
                {inspection.accept_count !== undefined && inspection.reject_count !== undefined && (
                  <Text style={styles.basicInfoValue}> (允收 {inspection.accept_count} / 拒收 {inspection.reject_count})</Text>
                )}
              </View>
            )}
            {/* AQL质量等级 */}
            {inspection.aql && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>AQL 等级 / AQL Level</Text>
                <Text style={styles.basicInfoValue}>{inspection.aql}</Text>
              </View>
            )}
            {/* 允收数/拒收数 */}
            {inspection.sample_size && inspection.aql && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>允收数(Ac) | 拒收数(Re)</Text>
                <Text style={styles.basicInfoValue}>
                  {Math.floor(Number(inspection.sample_size) * 0.06)} | {Math.ceil(Number(inspection.sample_size) * 0.08)}
                </Text>
              </View>
            )}
            {/* 验货日期 */}
            {inspection.inspection_date && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>验货日期 / Date</Text>
                <Text style={styles.basicInfoValue}>{inspection.inspection_date}</Text>
              </View>
            )}
            {/* 验货员 */}
            {inspection.inspector && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>验货员 / Inspector</Text>
                <Text style={styles.basicInfoValue}>{inspection.inspector}</Text>
              </View>
            )}
            {/* 颜色 */}
            {inspection.color && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>颜色 / Color</Text>
                <Text style={styles.basicInfoValue}>{inspection.color}</Text>
              </View>
            )}
            {/* 尺码 */}
            {inspection.size && (
              <View style={styles.basicInfoItem}>
                <Text style={styles.basicInfoLabel}>尺码 / Size</Text>
                <Text style={styles.basicInfoValue}>{inspection.size}</Text>
              </View>
            )}
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>检查进度 / Progress</Text>
              <Text style={styles.progressValue}>{progress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{inspection.checkedCount}</Text>
                <Text style={styles.statLabel}>已检查 / Checked</Text>
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
                <Text style={styles.statLabel}>待检查 / Pending</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 验货清单 */}
        {categories.filter(c => c !== '条码扫描以及拍照' && c !== '问题统计以及拍照并描述').map((category, catIndex) => {
          return (
            <View key={category} style={styles.section}>
              <View style={styles.categoryHeader}>
                <View>
                  <Text style={styles.sectionTitle}>{categoryBilingualMap[category] || category}</Text>
                  <Text style={styles.sectionTitleEnglish}>{categoryEnglishMap[category] || ''}</Text>
                </View>
              </View>
              {inspection.checklist_items
                .filter(item => item.category === category)
              .map(item => (
                <View key={item.record_id} style={styles.checklistItem}>
                  <View style={styles.checklistHeader}>
                    <View style={styles.checklistInfo}>
                      {/* 拍照和导入按钮，与下方操作按钮宽度对齐 */}
                      {item.status === 'unchecked' && inspection.status !== 'completed' && (
                        <View style={styles.actionButtonsRow}>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.photoButton]}
                            onPress={() => takePhoto(item)}
                          >
                            <Feather name="camera" size={16} color="#FFFFFF" />
                            <Text style={styles.photoButtonText}>拍照</Text>
                          </TouchableOpacity>
                          {/* 导入本地照片按钮 - 仅管理员可见 */}
                          {isAdmin && (
                            <TouchableOpacity
                              style={[styles.actionButton, styles.photoButton]}
                              onPress={() => handleImportFromGallery(item)}
                            >
                              <Feather name="image" size={16} color="#FFFFFF" />
                              <Text style={styles.photoButtonText}>导入</Text>
                            </TouchableOpacity>
                          )}
                        </View>
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
                            <Feather name="camera" size={24} color="#FFFFFF" />
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
                      {(() => {
                        // 调试日志 - 无论是否有照片都打印
                        console.log(`[PAGE_LOAD] 检查项: ${item.name}, photos:`, item.photos, ', barcodeCodes:', item.barcodeCodes);
                        if (item.photos && item.photos.length > 0) {
                          console.log(`[PHOTO_DEBUG] 照片数量: ${item.photos.length}, 第一张:`, item.photos[0], ', getImageUrl:', getImageUrl(item.photos[0]));
                        }
                        return item.photos && item.photos.length > 0 ? (
                          <View style={styles.photoPreviewSection}>
                            <View style={styles.photoGridContainer}>
                              {item.photos.map((photo, idx) => (
                                <TouchableOpacity key={idx} onPress={() => {
                                  // 点击照片跳转到编辑页面
                                  router.push('/photo-edit' as any, {
                                    photos: item.photos,
                                    initialIndex: idx,
                                    itemRecordId: item.record_id,
                                    itemId: item.id,
                                    inspectionId: id,
                                  });
                                }} style={styles.photoContainer}>
                                  <Image source={{ uri: getImageUrl(photo) }} style={styles.photoThumb} />
                                  {item.status !== 'pass' && (
                                    <TouchableOpacity style={styles.photoDeleteButton}
                                      onPress={() => {
                                        if (!inspectionRef.current) return;
                                        const updatedItems = (inspectionRef.current.checklist_items || []).map((i: ChecklistItem) => {
                                          if (i.record_id === item.record_id) {
                                            return { ...i, photos: (i.photos || []).filter((_: any, pi: number) => pi !== idx) };
                                          }
                                          return i;
                                        });
                                        const updated: InspectionDetail = { ...inspectionRef.current, checklist_items: updatedItems };
                                        setInspection(updated);
                                      }}>
                                      <Text style={styles.photoDeleteText}>X</Text>
                                    </TouchableOpacity>
                                  )}
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ) : null;
                      })()}

                      {/* 已扫描的条码 - 所有分类都显示 */}
                      {(() => {
                        return item.barcodeCodes && item.barcodeCodes.length > 0 ? (
                          <View style={styles.barcodePreviewSection}>
                            <Text style={styles.barcodePreviewLabel}>已扫描条码 ({item.barcodeCodes.length})</Text>
                            <View style={styles.barcodeCodesRow}>
                              {item.barcodeCodes.map((code, idx) => (
                                <View key={idx} style={styles.barcodeCodeItem}>
                                  <Feather name="code" size={14} color="#6C63FF" />
                                  <Text style={styles.barcodeCodeText}>{code}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ) : null;
                      })()}

                      {item.status === 'unchecked' && inspection.status !== 'completed' && (
                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.passButton]}
                            onPress={() => updateChecklistItem(item, 'pass')}
                          >
                            <Feather name="check" size={16} color="#00B894" />
                            <Text style={styles.passButtonText}>合格</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.failButton]}
                            onPress={() => {
                              setSelectedItem(item);
                              setDefectModalVisible(true);
                            }}
                          >
                            <Feather name="x" size={16} color="#FF6B6B" />
                            <Text style={styles.failButtonText}>不合格</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.naButton]}
                            onPress={() => updateChecklistItem(item, 'na')}
                          >
                            <Feather name="slash" size={16} color="#808080" />
                            <Text style={styles.naButtonText}>不适用</Text>
                          </TouchableOpacity>
                          {/* 条码分类显示扫码按钮 */}
                          {item.category === '条码扫描以及拍照' && (
                            <TouchableOpacity
                              style={[styles.actionButton, styles.scanButton]}
                              onPress={() => openBarcodeScanner(item)}
                            >
                              <Feather name="maximize-2" size={18} color="#6C63FF" />
                              <Text style={styles.scanButtonText}>扫码 / Scan</Text>
                            </TouchableOpacity>
                          )}
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
        {categories.includes('条码扫描以及拍照') && (
          <View style={styles.section}>
            <View style={styles.categoryHeader}>
              <View>
                <Text style={styles.sectionTitle}>条码扫描以及拍照</Text>
                <Text style={styles.sectionTitleEnglish}>Barcode Scan</Text>
              </View>
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
                          : t('selectType')}
                      </Text>
                      <Feather name="chevron-down" size={16} color={item.barcodeType ? barcodeTypeOptions.find(o => o.value === item.barcodeType)?.color : '#666'} />
                    </TouchableOpacity>

                    {/* 拍照和导入按钮放在同一行，与下方操作按钮宽度对齐 */}
                    {item.status === 'unchecked' && inspection.status !== 'completed' && (
                      <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.photoButton]}
                          onPress={() => takePhoto(item)}
                        >
                          <Feather name="camera" size={14} color="#FFFFFF" />
                          <Text style={styles.photoButtonText}>拍照</Text>
                        </TouchableOpacity>
                        {/* 导入本地照片按钮 - 仅管理员可见 */}
                        {isAdmin && (
                          <TouchableOpacity
                            style={[styles.actionButton, styles.photoButton]}
                            onPress={() => handleImportFromGallery(item)}
                          >
                            <Feather name="image" size={14} color="#FFFFFF" />
                            <Text style={styles.photoButtonText}>导入</Text>
                          </TouchableOpacity>
                        )}
                        {/* 扫码按钮 - 在导入后面 */}
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: '#6C63FF' }]}
                          onPress={() => openBarcodeScanner(item)}
                        >
                          <Feather name="maximize-2" size={14} color="#FFFFFF" />
                          <Text style={[styles.photoButtonText, { color: '#FFFFFF' }]}>扫码</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {/* 状态图标 */}
                    <View style={styles.checklistActionsRow}>
                      {item.status !== 'unchecked' && (
                        <View style={[styles.statusIcon, {
                          backgroundColor: item.status === 'pass' ? 'rgba(0,184,148,0.15)' : 'rgba(255,107,107,0.15)'
                        }]}>
                          <Feather name={item.status === 'pass' ? 'check' : 'x'} size={16}
                            color={item.status === 'pass' ? '#00B894' : '#FF6B6B'} />
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {/* 已扫描的条码 */}
                  {item.barcodeCodes && item.barcodeCodes.length > 0 && (
                    <View style={styles.barcodePreviewSection}>
                      <View style={styles.barcodeCodesRow}>
                        {item.barcodeCodes.map((code, idx) => (
                          <View key={idx} style={styles.barcodeCodeItem}>
                            <Feather name="code" size={14} color="#6C63FF" />
                            <Text style={styles.barcodeCodeText}>{code}</Text>
                            <TouchableOpacity onPress={() => handleDeleteBarcodeCode(item.id, code)}>
                              <Feather name="x-circle" size={16} color="#FF5252" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {/* 已保存的照片预览 */}
                  {item.photos && item.photos.length > 0 && (
                    <View style={styles.issuePhotosContainer}>
                      {item.photos.map((photo, idx) => (
                        <TouchableOpacity key={idx} style={styles.issuePhotoItem}
                          onPress={() => {
                            setEditingPhoto({ uri: photo, recordId: item.record_id, index: idx });
                            setTempPhotos([]);
                            setTempPhotoTarget(item);
                            setCameraVisible(true);
                          }}>
                          <Image source={{ uri: getImageUrl(photo) }} style={styles.issuePhoto} />
                          {/* 删除按钮 - 显示编号 */}
                          <TouchableOpacity style={styles.removeIssuePhotoButton}
                            onPress={() => {
                              const updatedItems = barcodeItems.map(barcodeItem => {
                                if (barcodeItem.record_id === item.record_id) {
                                  return { ...barcodeItem, photos: (barcodeItem.photos || []).filter((_, i) => i !== idx) };
                                }
                                return barcodeItem;
                              });
                              setBarcodeItems(updatedItems);
                            }}>
                            <Text style={styles.removeIssuePhotoText}>{idx + 1}</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  
                  {/* 操作按钮行：合格、不合格、不适用 */}
                  {item.status === 'unchecked' && inspection.status !== 'completed' && (
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.passButton]}
                        onPress={() => updateChecklistItem(item, 'pass')}
                      >
                        <Feather name="check" size={14} color="#00B894" />
                        <Text style={styles.passButtonText}>合格</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.failButton]}
                        onPress={() => {
                          setSelectedItem(item);
                          setDefectModalVisible(true);
                        }}
                      >
                        <Feather name="x" size={14} color="#FF6B6B" />
                        <Text style={styles.failButtonText}>不合格</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.naButton]}
                        onPress={() => updateChecklistItem(item, 'na')}
                      >
                        <Feather name="slash" size={14} color="#808080" />
                        <Text style={styles.naButtonText}>不适用</Text>
                      </TouchableOpacity>
                      {/* 删除按钮 - 仅对新增的条码扫描项显示 */}
                      {isExtraItem && (
                        <TouchableOpacity 
                          style={[styles.actionButton, styles.removeIssueButton]}
                          onPress={() => {
                            setBarcodeItems(barcodeItems.filter(i => i.record_id !== item.record_id));
                          }}
                        >
                          <Feather name="trash-2" size={14} color="#FF6B6B" />
                          <Text style={styles.removeIssueText}>删除</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  {item.status === 'unchecked' && inspection.status === 'completed' && (
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity 
                        style={styles.issueCameraButton} 
                        onPress={() => openBarcodeScanner(item)}
                      >
                        <Feather name="maximize-2" size={16} color="#6C63FF" />
                        <Text style={styles.issueCameraText}>扫码</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* 问题统计以及拍照并描述 - 检查项照片显示 */}
        {(() => {
          const rawItems = inspection?.checklist_items || [];
          const problemCategoryItems = rawItems.filter((item: any) => 
            (item.category || item.item_category) === '问题统计以及拍照并描述'
          );
          return problemCategoryItems.length > 0 && (
            <View style={styles.section}>
              <View style={styles.categoryHeader}>
                <View>
                  <Text style={styles.sectionTitle}>问题统计以及拍照并描述</Text>
                  <Text style={styles.sectionTitleEnglish}>Problem Statistics</Text>
                </View>
              </View>
              {problemCategoryItems.map((item, idx) => (
                <View key={item.id || idx} style={styles.checklistItem}>
                  <View style={styles.checklistTitleRow}>
                    <Text style={styles.checklistItemName}>{item.name}</Text>
                  </View>
                  {/* 检查项照片显示 */}
                  {item.photos && item.photos.length > 0 && (
                    <View style={styles.photoContainer}>
                      {item.photos.map((photo, photoIdx) => (
                        <TouchableOpacity 
                          key={photoIdx} 
                          style={styles.photoItem}
                          onPress={() => {
                            setSelectedPhoto(photo);
                            setPhotoModalVisible(true);
                          }}
                        >
                          <Image source={{ uri: getImageUrl(photo) }} style={styles.photoThumb} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {/* 检查项条码显示 */}
                  {item.barcodeCodes && item.barcodeCodes.length > 0 && (
                    <View style={styles.barcodeContainer}>
                      {item.barcodeCodes.map((code, codeIdx) => (
                        <View key={codeIdx} style={styles.barcodeItem}>
                          <Feather name="code" size={16} color="#6C63FF" />
                          <Text style={styles.barcodeText}>{code}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })()}

        {/* 问题描述列表 */}
        {issues.length > 0 && (
          <View style={styles.section}>
            <View style={styles.categoryHeader}>
              <View>
                <Text style={styles.sectionTitle}>问题描述列表</Text>
                <Text style={styles.sectionTitleEnglish}>Problem Description List</Text>
              </View>
              {inspection.status !== 'completed' && (
                <TouchableOpacity style={styles.addIssueButton} onPress={handleAddIssue}>
                  <Feather name="plus" size={18} color="#6C63FF" />
                  <Text style={styles.addIssueText}>{t('addProblem')}</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* 缺陷统计表格 */}
            <View style={styles.defectStatsContainer}>
              <Text style={styles.defectStatsTitle}>{t('defectStatistics')}</Text>
              <View style={styles.defectStatsTable}>
                <View style={styles.defectStatsRow}>
                  <Text style={styles.defectStatsLabel}>{t('criticalDefect')}</Text>
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
                  <Text style={styles.defectStatsLabel}>{t('majorDefect')}</Text>
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
                  <Text style={styles.defectStatsLabel}>{t('minorDefect')}</Text>
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
                        : `${t('selectDefectLevel')} / Select defect level`}
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
                  placeholder={t('pleaseInputProblemDescription')}
                  placeholderTextColor="#B2BEC3"
                  multiline
                  value={issue.text}
                  onChangeText={(text) => handleIssueChange(index, text)}
                />
                {/* 问题照片预览 */}
                {issue.photos.length > 0 && (
                  <View style={styles.issuePhotosContainer}>
                    {issue.photos.map((photo, photoIndex) => (
                      <TouchableOpacity key={photoIndex} style={styles.issuePhotoItem}
                        onPress={() => {
                          setEditingPhoto({ uri: photo, issueIndex: index, photoIndex: photoIndex });
                          setEditPhotoModalVisible(true);
                        }}
                        onLongPress={() => handleRemoveIssuePhoto(index, photoIndex)}>
                        <Image source={{ uri: photo }} style={styles.issuePhoto} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {/* 拍照按钮 - 仅在未完成时显示 */}
                {inspection.status !== 'completed' && (
                  <TouchableOpacity style={styles.issueCameraButton} onPress={() => handleOpenCamera(index)}>
                    <Feather name="camera" size={18} color="#FFFFFF" />
                    <Text style={styles.issueCameraText}>拍照 / Camera</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 缺陷记录 */}
        {inspection.defects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>缺陷记录 / Defect Records ({inspection.defects.length})</Text>
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
                      {defect.severity === 'critical' ? t('critical') : defect.severity === 'major' ? t('major') : t('minor')}
                    </Text>
                  </View>
                  <Text style={styles.defectItem}>{defect.title}</Text>
                </View>
                <Text style={styles.defectDescription}>{defect.description}</Text>
                {defect.photo_urls && defect.photo_urls.length > 0 && (
                  <View style={styles.defectPhotosWrap}>
                    {defect.photo_urls.map((photo, idx) => (
                      <TouchableOpacity key={idx} onPress={() => {
                        setSelectedPhoto(photo);
                        setPhotoModalVisible(true);
                      }}>
                        <Image source={{ uri: photo }} style={styles.defectPhotoThumb} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>

        )}

        {/* 已扫描条码 */}
        {scannedCodes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>已扫描条码 / Scanned Barcodes ({scannedCodes.length})</Text>
            {scannedCodes.map((code, idx) => (
              <View key={idx} style={styles.scannedCodeItem}>
                <Feather name="code" size={18} color="#6C63FF" />
                <Text style={styles.scannedCodeText}>{code}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 导出按钮区域 - 所有状态都可导出 */}
        <View style={styles.exportButtonContainer}>
          <TouchableOpacity style={styles.exportPhotosButton} onPress={handleExportPhotos}>
            <Feather name="image" size={20} color="#FFFFFF" />
            <Text style={styles.exportButtonText}>导出验货照片</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportReportButton, exportingReport && styles.exportButtonDisabled]}
            onPress={handleExportReport}
            disabled={exportingReport}
          >
            {exportingReport ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="file-text" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.exportButtonText}>
              {exportingReport ? '生成中...' : '导出验货报告'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 提交按钮 */}
        {inspection.status !== 'completed' && (
          <View style={styles.flexRow}>
            <TouchableOpacity style={styles.submitPassButton} onPress={handleSubmitPass}>
              <Text style={styles.submitButtonText}>{t('submitPass')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitFailButton} onPress={handleSubmitFail}>
              <Text style={styles.submitButtonText}>{t('submitFail')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 缺陷记录 Modal */}
      <Modal visible={defectModalVisible} transparent animationType="slide"
        onRequestClose={() => setDefectModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1}
          onPress={() => setDefectModalVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>记录缺陷 / Record Defect</Text>
              <TouchableOpacity onPress={() => setDefectModalVisible(false)}>
                <Feather name="x" size={24} color="#636E72" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>{t('inspectionItem')}: {selectedItem?.name}</Text>

            <Text style={styles.modalLabel}>{t('defectLevel')}</Text>
            <View style={styles.severityButtons}>
              {(['critical', 'major', 'minor'] as const).map(level => (
                <TouchableOpacity
                  key={level}
                  style={[styles.severityButton, defectForm.severity === level && styles.severityButtonActive]}
                  onPress={() => setDefectForm({ ...defectForm, severity: level })}
                >
                  <Text style={[styles.severityButtonText, defectForm.severity === level && styles.severityButtonTextActive]}>
                    {level === 'critical' ? t('critical') : level === 'major' ? t('major') : t('minor')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>{t('defectDescription')}</Text>
            <TextInput
              style={styles.textArea}
              placeholder={t('defectDescriptionPlaceholder')}
              placeholderTextColor="#B2BEC3"
              multiline
              numberOfLines={4}
              value={defectForm.description}
              onChangeText={(text) => setDefectForm({ ...defectForm, description: text })}
            />

            <Text style={styles.modalLabel}>{t('defectPhoto')}</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoActionButton} onPress={() => takePhoto()}>
                <Feather name="camera" size={20} color="#FFFFFF" />
                <Text style={styles.photoActionText}>拍照 / Camera</Text>
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
              <Text style={styles.submitButtonText}>{t('confirmAdd')}</Text>
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
              <Text style={styles.submitButtonText}>{t('complete')}</Text>
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
              {hasScannedBarcode ? t('scanSuccess') : `${t('barcodeScan')} - ${barcodeScanTarget?.name || ''}`}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* 相机预览 */}
          {barcodePermission?.granted ? (
            showBarcodeCamera ? (
              // 扫描中显示相机
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
            ) : null
          ) : (
            <View style={styles.barcodePermissionContainer}>
              <Text style={styles.barcodePermissionText}>需要相机权限来扫描条码</Text>
              <TouchableOpacity style={styles.barcodePermissionButton} onPress={requestBarcodePermission}>
                <Text style={styles.barcodePermissionButtonText}>授予权限</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 底部提示 */}
          {!hasScannedBarcode && (
            <View style={styles.barcodeScannerFooter}>
              <Text style={styles.barcodeScannerHint}>将条码对准扫描框内</Text>
              <Text style={styles.barcodeScannerHintSub}>支持二维码、 EAN、 UPC、 Code 等格式</Text>
            </View>
          )}
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
                  const currentItem = selectedBarcodeIndex !== null ? barcodeItems[selectedBarcodeIndex] : null;
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
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
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
  supplierNameValue: {
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
  // 同步按钮样式
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  syncButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
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
    backgroundColor: '#8B7FF5',
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
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 4,
  },
  sectionTitleEnglish: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6C63FF',
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
    backgroundColor: '#8B7FF5',
    borderRadius: 8,
    gap: 4,
  },
  categoryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scanButton: {
    backgroundColor: '#8B7FF5',
    minWidth: 0,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
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
  checklistTitleRow: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  checklistItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 2,
  },
  checklistItemNameEnglish: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6C63FF',
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checklistInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checklistNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  cameraButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  checklistActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  checklistName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
    flexWrap: 'wrap',
    flex: 1,
  },
  headerCameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#8B7FF5',
    gap: 4,
  },
  headerCameraButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
    borderRadius: 10,
    backgroundColor: '#8B7FF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 4,
  },
  completePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B7FF5',
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  passButton: {
    backgroundColor: 'rgba(0,184,148,0.15)',
    minWidth: 0,
  },
  passButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00B894',
    flexShrink: 1,
  },
  failButton: {
    backgroundColor: 'rgba(255,107,107,0.15)',
    minWidth: 0,
  },
  failButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B6B',
    flexShrink: 1,
  },
  naButton: {
    backgroundColor: 'rgba(128,128,128,0.15)',
    minWidth: 0,
  },
  naButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#808080',
    flexShrink: 1,
  },
  photoButton: {
    backgroundColor: '#8B7FF5',
    minWidth: 0,
  },
  photoButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    flexShrink: 1,
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
    color: '#8B7FF5',
    marginLeft: 6,
    fontWeight: '500',
  },
  photoContainer: {
    position: 'relative',
    marginRight: 8,
  },
  photoDeleteButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255, 107, 107, 0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoDeleteText: {
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
  photoGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoPreviewLabel: {
    fontSize: 13,
    color: '#6C63FF',
    fontWeight: '600',
    marginBottom: 10,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  photoItem: {
    width: 80,
    height: 80,
    marginRight: 8,
    marginBottom: 8,
  },
  barcodeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  barcodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  barcodeText: {
    fontSize: 12,
    color: '#6C63FF',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  defectPhotosWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  // 导出按钮样式
  exportButtonContainer: {
    marginTop: 20,
    marginBottom: 10,
    gap: 12,
  },
  exportPhotosButton: {
    flexDirection: 'row',
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  exportReportButton: {
    flexDirection: 'row',
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitPassButton: {
    flex: 1,
    marginTop: 20,
    marginRight: 8,
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  flexRow: {
    flexDirection: 'row',
  },
  submitFailButton: {
    flex: 1,
    marginTop: 20,
    marginLeft: 8,
    backgroundColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  submitButtonText: {
    fontSize: 14,
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
    paddingVertical: 12,
    backgroundColor: '#8B7FF5',
    borderRadius: 12,
    gap: 8,
  },
  photoActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
    backgroundColor: '#8B7FF5',
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
  // 条码扫描结果样式
  barcodeResultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 40,
  },
  barcodeSuccessIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16,185,129,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  barcodeSuccessText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 30,
  },
  barcodeResultLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  barcodeResultValue: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  barcodeCompleteButton: {
    marginTop: 40,
    backgroundColor: '#10B981',
    paddingHorizontal: 60,
    paddingVertical: 16,
    borderRadius: 30,
  },
  barcodeCompleteButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,107,107,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  removeIssueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B6B',
    marginLeft: 4,
    flexShrink: 1,
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
    backgroundColor: 'rgba(255,107,107,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIssuePhotoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
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
    backgroundColor: '#8B7FF5',
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 6,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginLeft: 44,
    gap: 8,
    width: '100%',
    maxWidth: Dimensions.get('window').width - 120,
  },
  issueSection: {
    marginTop: 16,
  },
  issueCameraText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
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
