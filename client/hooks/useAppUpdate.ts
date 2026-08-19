import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const VERSION_STORAGE_KEY = 'last_known_version';
const DISMISSED_VERSION_KEY = 'dismissed_version';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟检查一次

interface VersionCheckResult {
  needUpdate: boolean;
  forceUpdate: boolean;
  latestVersion: string;
  updateUrl: string;
  backupUrls: string[];
  releaseNotes: string;
}

interface UseAppUpdateReturn {
  hasUpdate: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  newVersion: string;
  updateUrl: string;
  backupUrls: string[];
  releaseNotes: string;
  checkUpdate: () => Promise<void>;
  dismissUpdate: () => Promise<void>;
}

// 获取当前 APP 版本号
function getCurrentVersion(): string {
  return Constants.expoConfig?.version || '1.0.0';
}

export function useAppUpdate(): UseAppUpdateReturn {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(getCurrentVersion());
  const [newVersion, setNewVersion] = useState('');
  const [updateUrl, setUpdateUrl] = useState('');
  const [backupUrls, setBackupUrls] = useState<string[]>([]);
  const [releaseNotes, setReleaseNotes] = useState('');

  const checkUpdate = useCallback(async (force = false) => {
    try {
      const version = getCurrentVersion();
      
      // 调用版本检查 API
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/versions/latest`
      );
      
      if (!response.ok) return;
      
      const data = await response.json();
      
      if (data.latestVersion && data.latestVersion !== version) {
        // 强制检查时，忽略用户的忽略状态
        if (!force) {
          // 检查用户是否已经忽略过这个版本
          const dismissedVersion = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
          
          if (dismissedVersion === data.latestVersion && !data.forceUpdate) {
            // 用户已忽略此版本且非强制更新，不提示
            return;
          }
        }
        
        setCurrentVersion(version);
        setNewVersion(data.latestVersion);
        setUpdateUrl(data.updateUrl || '');
        setBackupUrls([]);
        setReleaseNotes(data.releaseNotes || '');
        setForceUpdate(data.forceUpdate || false);
        setHasUpdate(true);
      }
    } catch (error) {
      console.error('[useAppUpdate] Check update failed:', error);
    }
  }, []);

  const dismissUpdate = useCallback(async () => {
    // 存储已忽略的版本（非强制更新时）
    if (newVersion && !forceUpdate) {
      await AsyncStorage.setItem(DISMISSED_VERSION_KEY, newVersion);
    }
    setHasUpdate(false);
  }, [newVersion, forceUpdate]);

  useEffect(() => {
    // 立即检查一次
    checkUpdate();
    
    // 定时检查
    const interval = setInterval(checkUpdate, CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, [checkUpdate]);

  return {
    hasUpdate,
    forceUpdate,
    currentVersion,
    newVersion,
    updateUrl,
    backupUrls,
    releaseNotes,
    checkUpdate,
    dismissUpdate,
  };
}
