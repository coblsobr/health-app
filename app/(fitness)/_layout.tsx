import { Tabs } from 'expo-router';
import { FitRail } from '../../components/fitChrome';

/**
 * Fitness navigates from a spine down the left edge, not a bar along the
 * bottom. `tabBarPosition: 'left'` makes the navigator lay its children out in
 * a row; `tabBar` replaces the bar itself with the rail.
 */
export default function FitnessTabs() {
  return (
    <Tabs
      tabBar={(props) => <FitRail {...props} />}
      screenOptions={{ headerShown: false, tabBarPosition: 'left' }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="log" options={{ title: 'Log' }} />
      <Tabs.Screen name="plan" options={{ title: 'Week' }} />
      <Tabs.Screen name="history" options={{ title: 'Past' }} />
      <Tabs.Screen name="progress" options={{ title: 'Trend' }} />
    </Tabs>
  );
}
