import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VERSION_STORAGE_KEY = 'last_known_version';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟检查一次

interface VersionInfo {
  version: string;
  commitHash: string;
  deployTime: string;
}

interface UseAppUpdateReturn {
  hasUpdate: boolean;
  currentVersion: string | null;
  newVersion: string | null;
  checkUpdate: () => Promise<void>;
  dismissUpdate: () => Promise<void>;
}

export function useAppUpdate(): UseAppUpdateReturn {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);

  const checkUpdate = useCallback(async () => {
    try {
      // 获取服务器版本
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/inspections/version`);
      if (!response.ok) return;
      
      const data = await response.json();
      if (!data.success) return;

      const serverVersion = data.version;
      
      // 获取本地存储的版本
      const localVersion = await AsyncStorage.getItem(VERSION_STORAGE_KEY);
      
      if (localVersion && localVersion !== serverVersion) {
        // 版本不同，有新版本
        setCurrentVersion(localVersion);
        setNewVersion(serverVersion);
        setHasUpdate(true);
      } else if (!localVersion) {
        // 首次使用，存储当前版本
        await AsyncStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
      }
    } catch (error) {
      console.error('[useAppUpdate] Check update failed:', error);
    }
  }, []);

  const dismissUpdate = useCallback(async () => {
    // 用户点击更新后，存储新版本
    if (newVersion) {
      await AsyncStorage.setItem(VERSION_STORAGE_KEY, newVersion);
    }
    setHasUpdate(false);
    setCurrentVersion(null);
    setNewVersion(null);
  }, [newVersion]);

  useEffect(() => {
    // 立即检查一次
    checkUpdate();
    
    // 定时检查
    const interval = setInterval(checkUpdate, CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, [checkUpdate]);

  return {
    hasUpdate,
    currentVersion,
    newVersion,
    checkUpdate,
    dismissUpdate
  };
}
