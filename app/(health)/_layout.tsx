import { Tabs } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { tabScreenOptions, tabIcon } from '../../components/tabBar';

export default function HealthTabs() {
  const { c } = useTheme();
  return (
    <Tabs screenOptions={tabScreenOptions(c, c.hlth)}>
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: tabIcon('clock') }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals', tabBarIcon: tabIcon('target') }} />
      <Tabs.Screen name="trends" options={{ title: 'Trends', tabBarIcon: tabIcon('chart') }} />
    </Tabs>
  );
}
