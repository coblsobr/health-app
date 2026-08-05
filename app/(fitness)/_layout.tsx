import { Tabs } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { tabScreenOptions, tabIcon, centreIcon } from '../../components/tabBar';

export default function FitnessTabs() {
  const { c } = useTheme();
  return (
    <Tabs screenOptions={tabScreenOptions(c, c.fit)}>
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: tabIcon('clock') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: tabIcon('diary') }} />
      <Tabs.Screen name="log" options={{ title: 'Log', tabBarIcon: centreIcon('plus', c.fit) }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: tabIcon('chart') }} />
    </Tabs>
  );
}
