import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * 获取 API 基础 URL
 * - Web: 返回空字符串（使用相对路径，同源请求）
 * - Native: 使用 EXPO_PUBLIC_BACKEND_BASE_URL 环境变量，或从 app config 中获取
 */
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web') {
    return '';
  }
  // 优先使用环境变量
  if (process.env.EXPO_PUBLIC_BACKEND_BASE_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
  }
  // 兜底：从 app config 的 extra 中获取
  const extra = (Constants.expoConfig?.extra as Record<string, string> | undefined) || {};
  if (extra.backendBaseUrl) {
    return extra.backendBaseUrl;
  }
  // 兜底：从 expoUpdates 的 manifest 中获取（适用于 EAS Update 或 Expo Go）
  const manifestExtra = (Constants.manifest?.extra as Record<string, string> | undefined) || {};
  if (manifestExtra.backendBaseUrl) {
    return manifestExtra.backendBaseUrl;
  }
  // 最终兜底：使用 COZE_PROJECT_DOMAIN_DEFAULT 环境变量（构建时注入）
  if (process.env.COZE_PROJECT_DOMAIN_DEFAULT) {
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT;
    // 如果已经包含协议前缀，直接返回
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      return domain;
    }
    return `https://${domain}`;
  }
  // 最后兜底：使用 executionEnvironment 判断是否在 Expo Go 中运行
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    // 在生产环境中，尝试从 Constants.hostUri 获取
    if (Constants.hostUri) {
      return `https://${Constants.hostUri}`;
    }
  }
  return '';
}
