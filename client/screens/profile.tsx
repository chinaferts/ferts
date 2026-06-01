import { Screen } from '@/components/Screen';
import { View, Text, StyleSheet } from 'react-native';
import { useCSSVariable } from 'uniwind';

export default function ProfileScreen() {
  const [background, card, text, muted, accent, border] = useCSSVariable([
    '--color-background',
    '--color-card',
    '--color-text',
    '--color-muted',
    '--color-accent',
    '--color-border',
  ]) as string[];

  return (
    <Screen>
      <View style={styles.container}>
        <View style={[styles.avatarContainer, { backgroundColor: accent }]}>
          <Text style={styles.avatarText}>检</Text>
        </View>
        <Text style={[styles.name, { color: text }]}>验货员</Text>
        <Text style={[styles.role, { color: muted }]}>质量检验员</Text>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <View style={styles.menuItem}>
            <Text style={[styles.menuText, { color: text }]}>账号设置</Text>
            <Text style={{ color: muted }}>›</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <View style={styles.menuItem}>
            <Text style={[styles.menuText, { color: text }]}>通知设置</Text>
            <Text style={{ color: muted }}>›</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <View style={styles.menuItem}>
            <Text style={[styles.menuText, { color: text }]}>关于我们</Text>
            <Text style={{ color: muted }}>›</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <View style={styles.menuItem}>
            <Text style={[styles.menuText, { color: text }]}>帮助与反馈</Text>
            <Text style={{ color: muted }}>›</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <View style={styles.menuItem}>
            <Text style={[styles.menuText, { color: text }]}>版本</Text>
            <Text style={{ color: muted }}>v1.0.0</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    marginBottom: 24,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuText: {
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginLeft: 20,
  },
});
