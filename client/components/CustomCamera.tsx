import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PhotoItem {
  uri: string;
  timestamp: number;
}

interface CustomCameraProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (photos: PhotoItem[]) => void;
  itemName?: string;
  initialPhotos?: PhotoItem[];
  editingPhotoUri?: string | null;
  onUpdatePhoto?: (originalUri: string, newUri: string) => void;
}

export default function CustomCamera({
  visible,
  onClose,
  onComplete,
  itemName = '验货',
  initialPhotos = [],
  editingPhotoUri = null,
  onUpdatePhoto,
}: CustomCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('auto');
  const cameraRef = useRef<CameraView>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);
  const [rotation, setRotation] = useState(0);

  // 重置照片列表当相机重新打开时
  useEffect(() => {
    if (visible) {
      if (editingPhotoUri) {
        // 编辑模式：加载要编辑的照片
        const editPhoto: PhotoItem = { uri: editingPhotoUri, timestamp: Date.now() };
        setPhotos([editPhoto]);
        setPreviewPhoto(editPhoto);
        setPreviewVisible(true);
      } else {
        // 新增模式：清空照片
        setPhotos([]);
      }
    }
  }, [visible, editingPhotoUri]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>请求相机权限中...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>需要相机权限才能拍照</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>授予权限</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButtonIOS} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: true,
        });
        if (photo?.uri) {
          const newPhoto: PhotoItem = {
            uri: photo.uri,
            timestamp: Date.now() + Math.random(),
          };
          setPhotos((prev) => [...prev, newPhoto]);
        }
      } catch (error) {
        console.error('拍照失败:', error);
        Alert.alert('错误', '拍照失败，请重试');
      }
    }
  };

  const removePhoto = (timestamp: number) => {
    setPhotos((prev) => prev.filter((p) => p.timestamp !== timestamp));
  };

  const handleComplete = () => {
    // 如果是编辑模式且没有新拍的照片，直接关闭
    if (editingPhotoUri && photos.length === 0) {
      onComplete([]);
      return;
    }
    
    if (photos.length > 0) {
      onComplete(photos);
    } else {
      Alert.alert('提示', '请至少拍摄一张照片');
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const cycleFlashMode = () => {
    setFlashMode((current) => {
      if (current === 'off') return 'auto';
      if (current === 'auto') return 'on';
      return 'off';
    });
  };

  const getFlashIcon = () => {
    switch (flashMode) {
      case 'on':
        return 'flash';
      case 'auto':
        return 'flash';
      default:
        return 'flash-off';
    }
  };

  const getFlashLabel = () => {
    switch (flashMode) {
      case 'on':
        return 'ON';
      case 'auto':
        return 'A';
      default:
        return '';
    }
  };

  const handleClose = () => {
    if (photos.length > 0) {
      Alert.alert(
        '确认退出',
        '确定要退出拍照吗？未保存的照片将被丢弃。',
        [
          { text: '取消', style: 'cancel' },
          { text: '确定', style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  };

  const handlePreviewPhoto = (photo: PhotoItem) => {
    setPreviewPhoto(photo);
    setRotation(0);
    setPreviewVisible(true);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDeletePreview = () => {
    if (previewPhoto) {
      removePhoto(previewPhoto.timestamp);
      setPreviewVisible(false);
      setPreviewPhoto(null);
    }
  };

  const handleClosePreview = () => {
    setPreviewVisible(false);
    setPreviewPhoto(null);
    setRotation(0);
  };

  const handleSaveRotation = async () => {
    if (!previewPhoto) {
      setPreviewVisible(false);
      setPreviewPhoto(null);
      setRotation(0);
      return;
    }

    try {
      // 如果有旋转，应用旋转
      if (rotation !== 0) {
        const manipResult = await ImageManipulator.manipulateAsync(
          previewPhoto.uri,
          [{ rotate: rotation }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );

        // 如果是编辑模式，调用 onUpdatePhoto 更新照片
        if (editingPhotoUri && onUpdatePhoto) {
          onUpdatePhoto(editingPhotoUri, manipResult.uri);
        } else {
          // 新增模式：更新照片列表中的URI
          setPhotos((prev) =>
            prev.map((p) =>
              p.timestamp === previewPhoto.timestamp
                ? { ...p, uri: manipResult.uri }
                : p
            )
          );
        }
      } else if (editingPhotoUri && onUpdatePhoto) {
        // 没有旋转但仍然是编辑模式，只调用更新
        onUpdatePhoto(editingPhotoUri, previewPhoto.uri);
      }
    } catch (error) {
      console.error('保存旋转失败:', error);
      Alert.alert('错误', '保存照片失败');
    }

    setPreviewVisible(false);
    setPreviewPhoto(null);
    setRotation(0);
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        <View style={styles.cameraWrapper}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
          />
        </View>

        {/* 顶部区域 */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={handleClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.flashButton} onPress={cycleFlashMode}>
            <Ionicons name={getFlashIcon() as any} size={22} color="#fff" />
            {flashMode !== 'off' && (
              <View style={styles.flashLabel}>
                <Text style={styles.flashLabelText}>{getFlashLabel()}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing}>
            <Ionicons name="camera-reverse" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* 底部区域 */}
        <View style={styles.bottomArea}>
          <Text style={styles.itemName}>{itemName}</Text>

          {/* 按钮组 */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shutterButton} onPress={takePicture}>
              <View style={styles.shutterButtonInner}>
                <View style={styles.shutterButtonCore} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.doneButton, photos.length === 0 && styles.doneButtonDisabled]}
              onPress={handleComplete}
              disabled={photos.length === 0}
            >
              <Text style={[styles.doneText, photos.length === 0 && styles.doneTextDisabled]}>
                完成
              </Text>
            </TouchableOpacity>
          </View>

          {/* 预览栏 */}
          {photos.length > 0 && (
            <View style={styles.previewStrip}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.previewScrollContent}
              >
                {photos.map((photo) => (
                  <TouchableOpacity
                    key={photo.timestamp}
                    style={styles.previewItem}
                    onPress={() => handlePreviewPhoto(photo)}
                  >
                    <Image source={{ uri: photo.uri }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.previewRemove}
                      onPress={() => removePhoto(photo.timestamp)}
                    >
                      <View style={styles.previewRemoveCircle}>
                        <Ionicons name="close" size={12} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

      {/* 照片预览 Modal */}
      <Modal visible={previewVisible} transparent animationType="fade">
        <View style={styles.previewModal}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={handleClosePreview}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.previewActionBtn} onPress={handleRotate}>
                <Ionicons name="refresh" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewActionBtn} onPress={handleDeletePreview}>
                <Ionicons name="trash" size={24} color="#ff4444" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.previewImageContainer}>
            {previewPhoto && (
              <Image
                source={{ uri: previewPhoto.uri }}
                style={[styles.previewFullImage, { transform: [{ rotate: `${rotation}deg` }] }]}
                resizeMode="contain"
              />
            )}
          </View>

          <View style={styles.previewFooter}>
            <TouchableOpacity style={styles.previewSaveBtn} onPress={handleSaveRotation}>
              <Text style={styles.previewSaveBtnText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraWrapper: {
    flex: 1,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // iOS 风格顶部栏
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonIOS: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  flashLabel: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#FF9500',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  flashLabelText: {
    color: '#000',
    fontSize: 9,
    fontWeight: 'bold',
  },

  // iOS 风格底部栏
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingTop: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cancelButton: {
    width: 60,
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '400',
  },
  // 拍照按钮 - 在取消和完成之间居中
  shutterButton: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  shutterButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButtonCore: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  doneButton: {
    width: 60,
    alignItems: 'center',
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  doneTextDisabled: {
    color: '#8E8E93',
  },

  // 底部区域：按钮组和预览栏
  bottomArea: {
    width: '100%',
    paddingBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  previewStrip: {
    paddingVertical: 10,
  },
  previewScrollContent: {
    paddingHorizontal: 16,
  },
  previewItem: {
    position: 'relative',
    marginRight: 8,
  },
  previewImage: {
    width: 75,
    height: 75,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  previewRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  previewRemoveCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 照片预览 Modal
  previewModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'space-between',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 16,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewActionBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  previewImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
  },
  previewFooter: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    paddingTop: 16,
  },
  previewSaveBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  previewSaveBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
