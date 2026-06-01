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
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoItem {
  uri: string;
  timestamp: number;
}

interface CustomCameraProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (photos: PhotoItem[]) => void;
  itemName?: string;
}

export default function CustomCamera({
  visible,
  onClose,
  onComplete,
  itemName = '验货',
}: CustomCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [facing, setFacing] = useState<CameraType>('back');
  const cameraRef = useRef<CameraView>(null);

  // 重置照片列表当相机重新打开时
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhotos([]);
    }
  }, [visible]);

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
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
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
            timestamp: Date.now(),
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
    if (photos.length > 0) {
      onComplete(photos);
    } else {
      Alert.alert('提示', '请至少拍摄一张照片');
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
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

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      >
        {/* 顶部区域 */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{itemName}</Text>
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* 预览区域 - 拍照按钮上方 */}
        <View style={styles.previewContainer}>
          {photos.length > 0 && (
            <View style={styles.previewSection}>
              <View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.previewScrollContent}
                >
                {photos.map((photo, index) => (
                  <View key={photo.timestamp} style={styles.previewItem}>
                    <Image source={{ uri: photo.uri }} style={styles.previewImage} />
                    <View style={styles.previewIndex}>
                      <Text style={styles.previewIndexText}>{index + 1}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removePhoto(photo.timestamp)}
                    >
                      <Ionicons name="close-circle" size={22} color="#ff3b30" />
                    </TouchableOpacity>
                  </View>
                ))}
                </ScrollView>
              </View>
              <Text style={styles.photoCount}>{photos.length} 张照片</Text>
            </View>
          )}
        </View>

        {/* 底部区域 - 拍照按钮和完成按钮 */}
        <View style={styles.bottomContainer}>
          <View style={styles.bottomContent}>
            {/* 拍照按钮 - 左侧 */}
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            {/* 完成按钮 - 拍照按钮右侧 */}
            <TouchableOpacity
              style={[styles.completeButton, photos.length === 0 && styles.completeButtonDisabled]}
              onPress={handleComplete}
              disabled={photos.length === 0}
            >
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.completeButtonText}>完成</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 0,
    right: 0,
    bottom: 180,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  previewSection: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
  },
  previewScrollContent: {
    paddingRight: 8,
  },
  previewItem: {
    position: 'relative',
    marginRight: 10,
  },
  previewImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  previewIndex: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewIndexText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 11,
  },
  photoCount: {
    color: '#fff',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
  },
  bottomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    marginRight: 20,
  },
  completeButtonDisabled: {
    backgroundColor: 'rgba(52,199,89,0.4)',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  captureButton: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  placeholder: {
    width: 80,
    marginLeft: 20,
  },
});
