import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
// Everything navigation-related comes from expo-router, which vendors its own
// copy of react-navigation. As of SDK 56 importing @react-navigation/* directly
// is a hard bundling error, so those packages are deliberately not installed.
import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { useFonts } from 'expo-font';
import { Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../components/Icon';

/** The three worlds, plus the two pages that hang off the bottom of the drawer. */
const SECTIONS: { route: string; label: string; icon: IconName }[] = [
  { route: '(nutrition)', label: 'Nutrition', icon: 'basket' },
  { route: '(fitness)', label: 'Fitness', icon: 'dumbbell' },
  { route: '(health)', label: 'Health', icon: 'chart' },
];

const EXTRAS: { route: string; label: string; icon: IconName }[] = [
  { route: 'settings', label: 'Settings', icon: 'settings' },
  { route: 'account', label: 'Account & Sync', icon: 'shield' },
];

function DrawerContent(props: DrawerContentComponentProps) {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  // The drawer route name of the screen currently showing.
  const current = props.state.routeNames[props.state.index];

  const Item = ({ route, label, icon }: { route: string; label: string; icon: IconName }) => {
    const active = current === route;
    return (
      <Pressable
        onPress={() => props.navigation.navigate(route as never)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          paddingVertical: 12,
          paddingLeft: active ? 15 : 18,
          paddingRight: 18,
          borderLeftWidth: active ? 3 : 0,
          borderLeftColor: c.nut,
          backgroundColor: active ? c.nutSoft : 'transparent',
        }}
      >
        <Icon name={icon} size={19} color={active ? c.nut : c.inkSoft} />
        <Text style={{ fontFamily: fonts.semi, fontSize: 13.5, color: active ? c.nut : c.inkSoft }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: insets.top + 8 }}>
        <View style={{ paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.line, marginBottom: 10 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 17, color: c.ink }}>Cody</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 9.5, color: c.inkFaint, marginTop: 3 }}>
            Goal not set yet
          </Text>
        </View>

        {SECTIONS.map((s) => <Item key={s.route} {...s} />)}

        <View style={{ height: 1, backgroundColor: c.line, marginVertical: 12, marginHorizontal: 18 }} />

        {EXTRAS.map((s) => <Item key={s.route} {...s} />)}
      </DrawerContentScrollView>

      <View style={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 14 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 9.5, color: c.inkFaint }}>v0.1.0 · shell build</Text>
      </View>
    </View>
  );
}

function Root() {
  const { c, resolved } = useTheme();
  return (
    <>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <Drawer
        drawerContent={(p) => <DrawerContent {...p} />}
        screenOptions={{
          headerShown: false,
          drawerType: 'front',
          drawerStyle: { width: 246, backgroundColor: c.surface },
          swipeEdgeWidth: 40,
        }}
      >
        <Drawer.Screen name="(nutrition)" options={{ title: 'Nutrition' }} />
        <Drawer.Screen name="(fitness)" options={{ title: 'Fitness' }} />
        <Drawer.Screen name="(health)" options={{ title: 'Health' }} />
        <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
        <Drawer.Screen name="account" options={{ title: 'Account & Sync' }} />
        {/* Reachable from the avatar, not listed in the drawer. */}
        <Drawer.Screen name="profile" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="index" options={{ drawerItemStyle: { display: 'none' } }} />
      </Drawer>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {loaded ? (
            <Root />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator />
            </View>
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
