import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Linking } from 'react-native';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { FontAwesome6 } from '@expo/vector-icons';

export function UpdatePrompt() {
  const { hasUpdate, currentVersion, newVersion, dismissUpdate } = useAppUpdate();

  const handleUpdate = async () => {
    // 关闭提示
    await dismissUpdate();
    
    // 如果是 web 平台，刷新页面
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
    // 如果是原生平台，提示用户重新打开应用
    // 在实际应用中，这里可以集成 CodePush 或其他热更新方案
  };

  if (!hasUpdate) return null;

  return (
    <Modal
      visible={hasUpdate}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <FontAwesome6 name="arrow-rotate-right" size={32} color="#4F46E5" />
          </View>
          
          <Text style={styles.title}>发现新版本</Text>
          <Text style={styles.message}>
            应用已更新到最新版本，请刷新以获取新功能。
          </Text>
          
          {currentVersion && newVersion && (
            <View style={styles.versionContainer}>
              <Text style={styles.versionText}>
                {currentVersion.substring(0, 7)} → {newVersion.substring(0, 7)}
              </Text>
            </View>
          )}
          
          <TouchableOpacity
            style={styles.button}
            onPress={handleUpdate}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>立即刷新</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  versionContainer: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#4F46E5',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
