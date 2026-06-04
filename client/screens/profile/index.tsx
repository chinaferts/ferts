import { Screen } from '@/components/Screen';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCSSVariable } from 'uniwind';
import { Feather } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { t } = useLanguage();
  const [background, card, text, muted, accent, border] = useCSSVariable([
    '--color-background',
    '--color-card',
    '--color-text',
    '--color-muted',
    '--color-accent',
    '--color-border',
  ]) as string[];

  const { user, isAdmin, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      `${t('logout')} / ${t('logoutEn')}`,
      t('logoutConfirm'),
      [
        { text: `${t('cancel')} / ${t('cancelEn')}`, style: 'cancel' },
        { text: `${t('confirm')} / ${t('confirmEn')}`, onPress: logout, style: 'destructive' },
      ]
    );
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* User Info Card */}
        <View style={[styles.userCard, { backgroundColor: card, borderColor: border }]}>
          <View style={[styles.avatarContainer, { backgroundColor: accent }]}>
            <Text style={styles.avatarText}>{user?.name?.[0] || 'U'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: text }]}>
              {user?.name || t('user')} / {user?.username || 'User'}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: isAdmin ? '#EEF2FF' : '#ECFDF5' }]}>
              <Text style={[styles.roleText, { color: isAdmin ? '#4F46E5' : '#059669' }]}>
                {isAdmin ? `${t('admin')} / ${t('adminEn')}` : `${t('inspector')} / ${t('inspectorEn')}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Settings Menu */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/account')}
          >
            <View style={styles.menuLeft}>
              <Feather name="settings" size={18} color="#6B7280" style={styles.menuIcon} />
              <View>
                <Text style={[styles.menuText, { color: text }]}>{t('accountSettings')}</Text>
                <Text style={[styles.menuTextEn, { color: muted }]}>{t('accountSettingsEn')}</Text>
              </View>
            </View>
            <Text style={{ color: muted }}>›</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Feather name="bell" size={18} color="#6B7280" style={styles.menuIcon} />
              <View>
                <Text style={[styles.menuText, { color: text }]}>{t('notificationSettings')}</Text>
                <Text style={[styles.menuTextEn, { color: muted }]}>{t('notificationSettingsEn')}</Text>
              </View>
            </View>
            <Text style={{ color: muted }}>›</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Feather name="info" size={18} color="#6B7280" style={styles.menuIcon} />
              <View>
                <Text style={[styles.menuText, { color: text }]}>{t('aboutUs')}</Text>
                <Text style={[styles.menuTextEn, { color: muted }]}>{t('aboutUsEn')}</Text>
              </View>
            </View>
            <Text style={{ color: muted }}>›</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Feather name="message-circle" size={18} color="#6B7280" style={styles.menuIcon} />
              <View>
                <Text style={[styles.menuText, { color: text }]}>{t('helpFeedback')}</Text>
                <Text style={[styles.menuTextEn, { color: muted }]}>{t('helpFeedbackEn')}</Text>
              </View>
            </View>
            <Text style={{ color: muted }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Version & Logout */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Feather name="smartphone" size={18} color="#6B7280" style={styles.menuIcon} />
              <View>
                <Text style={[styles.menuText, { color: text }]}>{t('version')}</Text>
                <Text style={[styles.menuTextEn, { color: muted }]}>{t('versionEn')}</Text>
              </View>
            </View>
            <Text style={{ color: muted }}>v1.0.0</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>{t('logout')} / {t('logoutEn')}</Text>
        </TouchableOpacity>
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
  userCard: {
    width: '90%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  card: {
    width: '90%',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuTextEn: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 46,
  },
  logoutButton: {
    width: '90%',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
});
