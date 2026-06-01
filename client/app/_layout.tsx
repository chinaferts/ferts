import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import Toast from 'react-native-toast-message';
import { Provider } from '@/components/Provider';

import '../global.css';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
]);

export default function RootLayout() {
  return (
    <Provider>
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          headerShown: false
        }}
      >
        <Stack.Screen name="index" options={{ title: "" }} />
        <Stack.Screen name="inspections" options={{ title: "验货任务" }} />
        <Stack.Screen name="inspections/new" options={{ title: "新建验货" }} />
        <Stack.Screen name="checklists" options={{ title: "清单模板" }} />
        <Stack.Screen name="defects" options={{ title: "缺陷记录" }} />
      </Stack>
      <Toast />
    </Provider>
  );
}
