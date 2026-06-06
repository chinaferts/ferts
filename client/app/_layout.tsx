import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { Provider } from '@/components/Provider';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';

import '../global.css';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
]);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const rootState = useRootNavigationState();

  useEffect(() => {
    if (!rootState?.key || isLoading) return;
    
    const inAuthRoute = segments[0] === '(auth)';
    
    if (!user && !inAuthRoute) {
      router.replace('/(auth)/login');
    } else if (user && inAuthRoute) {
      router.replace('/');
    }
  }, [rootState?.key, user, isLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <Provider>
      <LanguageProvider>
        <AuthProvider>
          <AuthGuard>
            <Stack
              screenOptions={{
                animation: 'slide_from_right',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                headerShown: false
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="inspections/index" options={{ headerShown: true, title: "验货任务", headerStyle: { backgroundColor: '#4F46E5' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } }} />
              <Stack.Screen name="inspections/new" options={{ headerShown: true, title: "新建验货", headerStyle: { backgroundColor: '#4F46E5' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } }} />
              <Stack.Screen name="checklists/index" options={{ headerShown: true, title: "清单模板", headerStyle: { backgroundColor: '#4F46E5' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } }} />
              <Stack.Screen name="checklists/[id]" options={{ headerShown: true, title: "清单详情", headerStyle: { backgroundColor: '#4F46E5' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } }} />
              <Stack.Screen name="defects/index" options={{ headerShown: true, title: "缺陷记录", headerStyle: { backgroundColor: '#4F46E5' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } }} />
              <Stack.Screen name="account/index" options={{ headerShown: true, title: "帐号设置", headerStyle: { backgroundColor: '#4F46E5' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } }} />
              <Stack.Screen name="inspections/[id]" options={{ headerShown: true, title: "验货详情", headerStyle: { backgroundColor: '#4F46E6' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } }} />
            </Stack>
            <Toast />
          </AuthGuard>
        </AuthProvider>
      </LanguageProvider>
    </Provider>
  );
}
