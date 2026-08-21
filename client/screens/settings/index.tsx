import { Screen } from '@/components/Screen';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCSSVariable } from 'uniwind';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { getApiBaseUrl } from '@/utils/api';

const API_BASE_URL = getApiBaseUrl();

export default function SettingsScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [background, card, text, muted, accent, border] = useCSSVariable([
    '--color-background',
    '--color-card',
    '--color-text',
    '--color-muted',
    '--color-accent',
    '--color-border',
  ]) as string[];

  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  const handleDeleteRecords = () => {
    Alert.alert(
      `${t('deleteAllRecords')} / ${t('deleteAllRecordsEn')}`,
      t('deleteAllRecordsConfirm'),
      [
        { text: `${t('cancel')} / ${t('cancelEn')}`, style: 'cancel' },
        {
          text: `${t('confirm')} / ${t('confirmEn')}`,
          style: 'destructive',
          onPress: async () => {
            setLoadingRecords(true);
            try {
              const res = await fetch(`${API_BASE_URL}/api/v1/inspections/admin/cleanup-records`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': String(user?.id),
                },
              });
              const data = await res.json();
              if (res.ok && data.success) {
                Alert.alert(t('cleanupSuccess'), t('deleteAllRecords') + ' ✓');
              } else {
                Alert.alert(t('cleanupFailed'), data.error || 'Unknown error');
              }
            } catch (err: any) {
              Alert.alert(t('cleanupFailed'), err.message || 'Network error');
            } finally {
              setLoadingRecords(false);
            }
          },
        },
      ]
    );
  };

  const handleClearPhotos = () => {
    Alert.alert(
      `${t('clearAllPhotos')} / ${t('clearAllPhotosEn')}`,
      t('clearAllPhotosConfirm'),
      [
        { text: `${t('cancel')} / ${t('cancelEn')}`, style: 'cancel' },
        {
          text: `${t('confirm')} / ${t('confirmEn')}`,
          style: 'destructive',
          onPress: async () => {
            setLoadingPhotos(true);
            try {
              const res = await fetch(`${API_BASE_URL}/api/v1/inspections/admin/cleanup-photos`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': String(user?.id),
                },
              });
              const data = await res.json();
              if (res.ok && data.success) {
                Alert.alert(t('cleanupSuccess'), t('clearAllPhotos') + ' ✓');
              } else {
                Alert.alert(t('cleanupFailed'), data.error || 'Unknown error');
              }
            } catch (err: any) {
              Alert.alert(t('cleanupFailed'), err.message || 'Network error');
            } finally {
              setLoadingPhotos(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: card, borderColor: border }]}>
          <View style={[styles.headerIcon, { backgroundColor: accent + '15' }]}>
            <Feather name="shield" size={24} color={accent} />
          </View>
          <Text style={[styles.headerTitle, { color: text }]}>
            {t('adminSettings')} / {t('adminSettingsEn')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: muted }]}>
            {user?.name || 'Admin'}
          </Text>
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>
            Danger Zone
          </Text>

          <TouchableOpacity
            style={[styles.dangerItem, { borderBottomColor: border }]}
            onPress={handleDeleteRecords}
            disabled={loadingRecords}
            activeOpacity={0.7}
          >
            <View style={styles.dangerLeft}>
              <View style={[styles.dangerIcon, { backgroundColor: '#FEE2E2' }]}>
                <Feather name="trash-2" size={18} color="#DC2626" />
              </View>
              <View style={styles.dangerText}>
                <Text style={[styles.dangerTitle, { color: text }]}>
                  {t('deleteAllRecords')}
                </Text>
                <Text style={[styles.dangerSubtitle, { color: muted }]}>
                  {t('deleteAllRecordsEn')}
                </Text>
              </View>
            </View>
            {loadingRecords ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Feather name="chevron-right" size={18} color={muted} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerItem}
            onPress={handleClearPhotos}
            disabled={loadingPhotos}
            activeOpacity={0.7}
          >
            <View style={styles.dangerLeft}>
              <View style={[styles.dangerIcon, { backgroundColor: '#FEF3C7' }]}>
                <Feather name="image" size={18} color="#D97706" />
              </View>
              <View style={styles.dangerText}>
                <Text style={[styles.dangerTitle, { color: text }]}>
                  {t('clearAllPhotos')}
                </Text>
                <Text style={[styles.dangerSubtitle, { color: muted }]}>
                  {t('clearAllPhotosEn')}
                </Text>
              </View>
            </View>
            {loadingPhotos ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <Feather name="chevron-right" size={18} color={muted} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    width: '90%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  section: {
    width: '90%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  dangerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dangerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dangerText: {
    flex: 1,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  dangerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
