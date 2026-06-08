import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PhotoPreviewScreen() {
  const router = useSafeRouter();
  const { photoUrl } = useSafeSearchParams<{ photoUrl: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 解码 URL
  const decodedUrl = photoUrl ? decodeURIComponent(photoUrl) : '';
  const fullUrl = decodedUrl.startsWith('http') 
    ? decodedUrl 
    : `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL || ''}${decodedUrl}`;

  const handleClose = () => {
    router.back();
  };

  return (
    <Screen className="flex-1 bg-black">
      <StatusBar barStyle="light-content" backgroundColor="black" />
      
      {/* 顶部导航栏 */}
      <View className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between px-4 pt-12 pb-2">
        <TouchableOpacity onPress={handleClose} className="p-2">
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-base font-medium">照片预览</Text>
        <View className="w-10" />
      </View>

      {/* 照片显示 */}
      <View className="flex-1 justify-center items-center">
        {loading && (
          <ActivityIndicator size="large" color="white" />
        )}
        {error ? (
          <View className="items-center">
            <Ionicons name="image-outline" size={64} color="gray" />
            <Text className="text-gray-400 mt-4">照片加载失败</Text>
          </View>
        ) : (
          <Image
            source={{ uri: fullUrl }}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
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
});
