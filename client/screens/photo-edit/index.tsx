import { getApiBaseUrl } from '@/utils/api';
import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Text,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createFormDataFile } from '@/utils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoEditParams {
  photos?: string | string[];
  initialIndex?: string | number;
  itemRecordId?: string | number;
  itemId?: string | number;
  inspectionId?: string | number;
}

// 获取完整的图片 URL
const getPhotoUrl = (photo: string): string => {
  if (!photo) return '';
  if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('data:')) {
    return photo;
  }
  if (photo.startsWith('file:') || photo.startsWith('content://') || photo.startsWith('ph://')) {
    return photo;
  }
  const baseUrl = getApiBaseUrl();
  return photo.startsWith('/') ? `${baseUrl}${photo}` : `${baseUrl}/${photo}`;
};

// 保存照片更新到服务器
const savePhotoUpdates = async (inspectionId: string | number, itemRecordId: string | number, photos: string[]) => {
  try {
    const response = await fetch(
      `${''}/api/v1/inspections/${inspectionId}/records/${itemRecordId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to save photos');
    }
    return true;
  } catch (error) {
    console.error('保存照片失败:', error);
    return false;
  }
};

export default function PhotoEditScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<PhotoEditParams>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 解析照片数组
  useEffect(() => {
    if (params.photos) {
      let parsed: string[] = [];
      if (typeof params.photos === 'string') {
        try {
          parsed = JSON.parse(params.photos);
        } catch {
          parsed = [params.photos];
        }
      } else if (Array.isArray(params.photos)) {
        parsed = params.photos;
      }
      setPhotos(parsed);
    }
    
    // 解析初始索引
    if (params.initialIndex) {
      setCurrentIndex(Number(params.initialIndex));
    }
  }, [params.photos, params.initialIndex]);

  const currentPhoto = photos[currentIndex];
  const currentPhotoUrl = currentPhoto ? getPhotoUrl(currentPhoto) : '';

  const handleClose = () => {
    router.back();
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setLoading(true);
      setError(false);
    }
  };

  const goToNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setLoading(true);
      setError(false);
    }
  };

  // 删除当前照片
  const handleDelete = async () => {
    Alert.alert(
      '删除照片',
      '确定要删除这张照片吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            const newPhotos = photos.filter((_, idx) => idx !== currentIndex);
            
            // 保存到服务器
            if (params.inspectionId && params.itemRecordId) {
              const saved = await savePhotoUpdates(params.inspectionId, params.itemRecordId, newPhotos);
              if (!saved) {
                Alert.alert('错误', '保存失败，请重试');
                return;
              }
            }
            
            setPhotos(newPhotos);
            if (currentIndex >= newPhotos.length && currentIndex > 0) {
              setCurrentIndex(currentIndex - 1);
            }
            // 返回结果给上一页
            router.back();
          },
        },
      ]
    );
  };

  // 替换照片
  const handleReplace = async () => {
    try {
      // 请求权限
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('权限不足', '需要相册权限来选择照片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhotoUri = result.assets[0].uri;
        const newPhotos = [...photos];
        newPhotos[currentIndex] = newPhotoUri;
        
        // 保存到服务器
        if (params.inspectionId && params.itemRecordId) {
          const saved = await savePhotoUpdates(params.inspectionId, params.itemRecordId, newPhotos);
          if (!saved) {
            Alert.alert('错误', '保存失败，请重试');
            return;
          }
        }
        
        setPhotos(newPhotos);
        
        // 返回结果给上一页
        router.back();
      }
    } catch (error) {
      console.error('选择照片失败:', error);
      Alert.alert('错误', '选择照片失败，请重试');
    }
  };

  // 如果没有照片，显示错误
  if (!currentPhoto) {
    return (
      <Screen className="flex-1 bg-black">
        <StatusBar barStyle="light-content" backgroundColor="black" />
        <View className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between px-4 pt-12 pb-2">
          <TouchableOpacity onPress={handleClose} className="p-2">
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-base font-medium">照片编辑</Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 justify-center items-center">
          <Ionicons name="image-outline" size={64} color="gray" />
          <Text className="text-gray-400 mt-4">没有照片</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen className="flex-1 bg-black">
      <StatusBar barStyle="light-content" backgroundColor="black" />
      
      {/* 顶部导航栏 */}
      <View className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between px-4 pt-12 pb-2">
        <TouchableOpacity onPress={handleClose} className="p-2">
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-base font-medium">
          {photos.length > 1 ? `${currentIndex + 1} / ${photos.length}` : '照片编辑'}
        </Text>
        <View className="w-10" />
      </View>

      {/* 照片显示 */}
      <View className="flex-1 justify-center items-center">
        {loading && (
          <View className="absolute z-10">
            <Ionicons name="sync" size={48} color="white" className="animate-spin" />
          </View>
        )}
        {error ? (
          <View className="items-center">
            <Ionicons name="image-outline" size={64} color="gray" />
            <Text className="text-gray-400 mt-4">照片加载失败</Text>
          </View>
        ) : (
          <Image
            source={{ uri: currentPhotoUrl }}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              console.log('图片加载错误:', e.nativeEvent);
              setLoading(false);
              setError(true);
            }}
          />
        )}
      </View>

      {/* 底部操作按钮 */}
      <View className="absolute bottom-0 left-0 right-0 pb-12">
        {/* 照片缩略图指示器 */}
        {photos.length > 1 && (
          <View className="flex-row justify-center mb-6">
            {photos.map((_, idx) => (
              <View
                key={idx}
                className={`w-2 h-2 rounded-full mx-1 ${idx === currentIndex ? 'bg-white' : 'bg-gray-500'}`}
              />
            ))}
          </View>
        )}
        
        {/* 操作按钮 */}
        <View className="flex-row justify-center px-8">
          <TouchableOpacity 
            onPress={handleDelete}
            style={styles.actionButton}
          >
            <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
            <Text style={styles.actionButtonText}>删除</Text>
          </TouchableOpacity>
          
          <View style={styles.buttonSpacer} />
          
          <TouchableOpacity 
            onPress={handleReplace}
            style={styles.actionButton}
          >
            <Ionicons name="image-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>替换</Text>
          </TouchableOpacity>
        </View>

        {/* 左右切换按钮 */}
        {photos.length > 1 && (
          <View className="flex-row justify-between px-4 mt-6">
            <TouchableOpacity 
              onPress={goToPrevious} 
              disabled={currentIndex === 0}
              className={`p-3 rounded-full ${currentIndex === 0 ? 'opacity-30' : 'opacity-100'}`}
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <Ionicons name="chevron-back" size={28} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={goToNext} 
              disabled={currentIndex === photos.length - 1}
              className={`p-3 rounded-full ${currentIndex === photos.length - 1 ? 'opacity-30' : 'opacity-100'}`}
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <Ionicons name="chevron-forward" size={28} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    minWidth: 100,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 4,
  },
  buttonSpacer: {
    width: 24,
  },
});
