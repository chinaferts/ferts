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
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoParams {
  photos?: string | string[];
  initialIndex?: string | number;
  photoUrl?: string;
}

export default function PhotoPreviewScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<PhotoParams>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 解析照片数组
  let photos: string[] = [];
  
  if (params.photos) {
    if (typeof params.photos === 'string') {
      try {
        photos = JSON.parse(params.photos);
      } catch {
        photos = [params.photos];
      }
    } else if (Array.isArray(params.photos)) {
      photos = params.photos;
    }
  }

  // 解析初始索引
  const initialIndex = params.initialIndex ? Number(params.initialIndex) : 0;

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // 获取当前照片URL
  const getPhotoUrl = (photo: string): string => {
    if (!photo) return '';
    
    // 如果是完整 URL 或 data URI，直接返回
    if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('data:')) {
      return photo;
    }
    
    // 如果是本地文件 URI，直接返回
    if (photo.startsWith('file:') || photo.startsWith('content://') || photo.startsWith('ph://')) {
      return photo;
    }
    
    // 如果是相对路径，拼接到服务器 URL
    const baseUrl = getApiBaseUrl();
    return photo.startsWith('/') ? `${baseUrl}${photo}` : `${baseUrl}/${photo}`;
  };

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

  // 如果没有照片，显示错误
  if (!currentPhoto) {
    return (
      <Screen className="flex-1 bg-black">
        <StatusBar barStyle="light-content" backgroundColor="black" />
        <View className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between px-4 pt-12 pb-2">
          <TouchableOpacity onPress={handleClose} className="p-2">
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-base font-medium">照片预览</Text>
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
          {photos.length > 1 ? `${currentIndex + 1} / ${photos.length}` : '照片预览'}
        </Text>
        <View className="w-10" />
      </View>

      {/* 照片显示 */}
      <View className="flex-1 justify-center items-center">
        {loading && (
          <View className="absolute z-10">
            <ActivityIndicator size="large" color="white" />
          </View>
        )}
        {error ? (
          <View className="items-center">
            <Ionicons name="image-outline" size={64} color="gray" />
            <Text className="text-gray-400 mt-4">照片加载失败</Text>
            <Text className="text-gray-500 text-sm mt-2">URL: {currentPhotoUrl.substring(0, 50)}...</Text>
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

      {/* 左右切换按钮 */}
      {photos.length > 1 && (
        <View className="absolute bottom-0 left-0 right-0 flex-row justify-between px-4 pb-12">
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

      {/* 照片缩略图指示器 */}
      {photos.length > 1 && (
        <View className="absolute bottom-24 left-0 right-0 flex-row justify-center">
          {photos.map((_, idx) => (
            <View
              key={idx}
              className={`w-2 h-2 rounded-full mx-1 ${idx === currentIndex ? 'bg-white' : 'bg-gray-500'}`}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
});
