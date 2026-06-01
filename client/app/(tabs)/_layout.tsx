import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useCSSVariable } from 'uniwind';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [background, muted, accent, border] = useCSSVariable([
    '--color-background',
    '--color-muted',
    '--color-accent',
    '--color-border',
  ]) as string[];

  let tabBarStyle: any = {
    backgroundColor: background,
    borderTopWidth: 1,
    borderTopColor: border,
    paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
    paddingTop: 8,
    height: 60 + (Platform.OS === 'ios' ? insets.bottom : 8),
  };

  if (Platform.OS === 'web') {
    tabBarStyle = {
      ...tabBarStyle,
      height: 'auto',
    };
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="house" size={size || 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inspections"
        options={{
          title: '验货',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="clipboard-check" size={size || 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: '记录',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="file-lines" size={size || 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="user" size={size || 20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
