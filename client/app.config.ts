import { ExpoConfig, ConfigContext } from 'expo/config';

const appName = 'FERTS验货APP';
const projectId = process.env.COZE_PROJECT_ID || process.env.EXPO_PUBLIC_COZE_PROJECT_ID;
const slugAppName = projectId ? `app${projectId}` : 'myapp';

export default ({ config }: ConfigContext): ExpoConfig => {
  // 使用硬编码的后端 URL 作为默认值，确保 GitHub Actions 构建的 APK 也能连接后端
  const backendBaseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'https://6458c7a8-0b18-46c1-a294-8cd82523b342.dev.coze.site';
  
  return {
    ...config,
    "name": appName,
    "slug": slugAppName,
    "version": "1.12.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "myapp",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "extra": {
      ...config.extra,
      backendBaseUrl,
    },
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.ferts.inspection"
    },
    "web": {
      "bundler": "metro",
      "output": "single",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      process.env.EXPO_PUBLIC_BACKEND_BASE_URL ? [
        "expo-router",
        {
          "origin": process.env.EXPO_PUBLIC_BACKEND_BASE_URL
        }
      ] : 'expo-router',
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": `允许Qarma验货App访问您的相册，以便您上传或保存图片。`,
          "cameraPermission": `允许Qarma验货App使用您的相机，以便您直接拍摄照片上传。`,
          "microphonePermission": `允许Qarma验货App访问您的麦克风，以便您拍摄带有声音的视频。`
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": `Qarma验货App需要访问您的位置以提供周边服务及导航功能。`
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": `Qarma验货App需要访问相机以拍摄照片和视频。`,
          "microphonePermission": `Qarma验货App需要访问麦克风以录制视频声音。`,
          "recordAudioAndroid": true
        }
      ],
      [
        "expo-media-library",
        {
          "photosPermission": `允许Qarma验货App访问您的相册，以便保存验货照片。`,
          "savePhotosPermission": `允许Qarma验货App保存照片到您的相册。`,
          "isAccessMediaLocationEnabled": true
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
