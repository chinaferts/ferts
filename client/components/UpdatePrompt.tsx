import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Linking, Platform } from 'react-native';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { FontAwesome6 } from '@expo/vector-icons';

export function UpdatePrompt() {
  const { hasUpdate, forceUpdate, currentVersion, newVersion, updateUrl, releaseNotes, dismissUpdate } = useAppUpdate();

  const handleUpdate = async () => {
    // 关闭提示
    await dismissUpdate();
    
    if (updateUrl) {
      try {
        await Linking.openURL(updateUrl);
      } catch (err) {
        console.error('打开下载链接失败:', err);
        alert('打开下载链接失败，请手动访问 GitHub Releases 页面下载');
      }
    }
    // 如果是 web 平台，刷新页面
    if (Platform.OS === 'web') {
      window.location.reload();
    }
  };

  const handleDismiss = async () => {
    if (!forceUpdate) {
      await dismissUpdate();
    }
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
          <Text style={styles.versionText}>
            {currentVersion} → {newVersion}
          </Text>
          
          {releaseNotes ? (
            <View style={styles.notesContainer}>
              <Text style={styles.notesTitle}>更新内容：</Text>
              <Text style={styles.notesText}>{releaseNotes}</Text>
            </View>
          ) : null}
          
          <TouchableOpacity
            style={styles.button}
            onPress={handleUpdate}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {(updateUrl || (backupUrls && backupUrls.length > 0)) ? '立即下载' : '立即刷新'}
            </Text>
          </TouchableOpacity>
          
          {!forceUpdate && (
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={handleDismiss}
              activeOpacity={0.8}
            >
              <Text style={styles.dismissButtonText}>稍后再说</Text>
            </TouchableOpacity>
          )}
          
          {forceUpdate && (
            <Text style={styles.forceText}>
              此为重要更新，请更新后继续使用
            </Text>
          )}
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
  versionText: {
    fontSize: 14,
    color: '#4F46E5',
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  notesContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 20,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    marginBottom: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  dismissButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    width: '100%',
  },
  dismissButtonText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  forceText: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 8,
  },
});
