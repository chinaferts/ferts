import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { Provider } from '@/components/Provider';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
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
            <Stack.Screen name="(tabs)" options={{ title: "" }} />
            <Stack.Screen name="(auth)" options={{ title: "" }} />
            <Stack.Screen name="inspections" options={{ title: "验货任务" }} />
            <Stack.Screen name="inspections/new" options={{ title: "新建验货" }} />
            <Stack.Screen name="checklists" options={{ title: "清单模板" }} />
            <Stack.Screen name="checklists/[id]" options={{ title: "清单详情" }} />
            <Stack.Screen name="defects" options={{ title: "缺陷记录" }} />
            <Stack.Screen name="account" options={{ title: "帐号设置" }} />
          </Stack>
          <Toast />
        </AuthGuard>
      </AuthProvider>
    </Provider>
  );
}
