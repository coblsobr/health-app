import React from 'react';
import { View, Text, Pressable, ScrollView, StatusBar as RNStatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter, useSegments } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

/**
 * Which world we are in, taken from the route.
 *
 * Each section wears its own colour in the chrome, so Nutrition and Fitness
 * read as related apps that talk to each other rather than one flat app with
 * a colour-coded tab bar.
 */
function useSectionTone() {
  const { c } = useTheme();
  // useSegments, not usePathname: expo-router strips group segments from the
  // pathname, so "/(fitness)/today" arrives as "/today" and every section
  // silently rendered the Nutrition colour.
  const segments = useSegments() as string[];
  if (segments.includes('(fitness)')) return c.fit;
  if (segments.includes('(health)')) return c.hlth;
  return c.nut;
}

/**
 * Every screen: a filled section-coloured bar with the hamburger, the title
 * and the profile, then the page beneath it.
 */
export function Screen({
  title,
  subtitle,
  children,
  scroll = true,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  /** Optional right-hand action, replacing the profile avatar. */
  action?: React.ReactNode;
}) {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const tone = useSectionTone();

  const Body = scroll ? ScrollView : View;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <RNStatusBar barStyle="light-content" backgroundColor={tone} />

      {/* section chrome */}
      <View style={{ backgroundColor: tone, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            height: 52,
          }}
        >
          <Pressable
            // Raw action rather than DrawerActions.openDrawer(): expo-router no
            // longer allows importing from @react-navigation/* (SDK 56+), and
            // that helper only ever returned this object.
            onPress={() => navigation.dispatch({ type: 'OPEN_DRAWER' })}
            hitSlop={14}
            style={{ width: 30, justifyContent: 'center', gap: 4.5 }}
            accessibilityLabel="Open sections menu"
            accessibilityRole="button"
          >
            <View style={{ width: 20, height: 2, borderRadius: 2, backgroundColor: '#fff' }} />
            <View style={{ width: 20, height: 2, borderRadius: 2, backgroundColor: '#fff' }} />
            <View style={{ width: 20, height: 2, borderRadius: 2, backgroundColor: '#fff' }} />
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 19, color: '#fff', letterSpacing: -0.2 }}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: 'rgba(255,255,255,0.82)', marginTop: -1 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {action ?? (
            <Pressable
              onPress={() => router.push('/profile')}
              hitSlop={14}
              accessibilityLabel="Profile"
              accessibilityRole="button"
              style={{
                width: 30, height: 30, borderRadius: 15,
                borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.7)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="person" size={16} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>

      <Body
        style={{ flex: 1 }}
        contentContainerStyle={scroll ? { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 } : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Body>
    </View>
  );
}
