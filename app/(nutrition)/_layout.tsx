import { Tabs } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { tabScreenOptions, tabIcon, centreIcon } from '../../components/tabBar';

export default function NutritionTabs() {
  const { c } = useTheme();
  return (
    <Tabs screenOptions={tabScreenOptions(c, c.nut)}>
      <Tabs.Screen name="diary" options={{ title: 'Diary', tabBarIcon: tabIcon('diary') }} />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: tabIcon('library') }} />
      <Tabs.Screen name="add" options={{ title: 'Add', tabBarIcon: centreIcon('plus', c.nut) }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop', tabBarIcon: tabIcon('cart') }} />
    </Tabs>
  );
}
