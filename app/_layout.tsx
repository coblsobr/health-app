import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
// Everything navigation-related comes from expo-router, which vendors its own
// copy of react-navigation. As of SDK 56 importing @react-navigation/* directly
// is a hard bundling error, so those packages are deliberately not installed.
import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { useFonts } from 'expo-font';
import * as Updates from 'expo-updates';
import { Fraunces_600SemiBold, Fraunces_700Bold, Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces';
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import {
  AlbertSans_400Regular, AlbertSans_500Medium, AlbertSans_600SemiBold, AlbertSans_700Bold,
} from '@expo-google-fonts/albert-sans';
// Fitness runs on its own two faces — see the note in theme/tokens.ts.
import {
  Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import { DMMono_300Light, DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';

import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../components/Icon';
import { initDb } from '../lib/db';

/** The three worlds, plus the two pages that hang off the bottom of the drawer. */
const SECTIONS: { route: string; label: string; icon: IconName }[] = [
  { route: 'recipes', label: 'Recipes', icon: 'library' },
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
        <Drawer.Screen name="recipes" options={{ title: 'Recipes' }} />
        <Drawer.Screen name="(nutrition)" options={{ title: 'Nutrition' }} />
        <Drawer.Screen name="(fitness)" options={{ title: 'Fitness' }} />
        <Drawer.Screen name="(health)" options={{ title: 'Health' }} />
        <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
        <Drawer.Screen name="account" options={{ title: 'Account & Sync' }} />
        {/* Reachable from the avatar or by navigation, not listed in the drawer. */}
        <Drawer.Screen name="profile" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="index" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="recipe" options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
      </Drawer>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_600SemiBold_Italic,
    Caveat_600SemiBold,
    AlbertSans_400Regular,
    AlbertSans_500Medium,
    AlbertSans_600SemiBold,
    AlbertSans_700Bold,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    DMMono_300Light,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  // Warm the database, but never block the UI on it. Screens that need storage
  // surface their own error, so a storage problem costs you those screens
  // rather than the whole app.
  useEffect(() => {
    initDb().catch(() => {});
  }, []);

  // Take an over-the-air update the moment it lands, rather than downloading it
  // now and applying it at some later launch. The default behaviour means a
  // change takes two restarts to appear, which reads as "it didn't update".
  // Safe against a loop: after reloading, the new bundle is current, so the
  // next check finds nothing.
  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web') return;
    let alive = true;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!alive || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (!alive) return;
        await Updates.reloadAsync();
      } catch {
        // Offline, or the update server is unreachable. Keep running on the
        // bundle already installed — never block launch on this.
      }
    })();
    return () => { alive = false; };
  }, []);

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
