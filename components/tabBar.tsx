import React from 'react';
import { View, Text, StyleSheet, type ColorValue } from 'react-native';
import { Icon, type IconName } from './Icon';
import type { Palette } from '../theme/tokens';
import { fonts } from '../theme/tokens';

/**
 * Shared bottom-tab styling. Each world passes its own accent, so Nutrition
 * reads coral, Fitness green and Health violet without duplicating layout.
 *
 * Note: the return type is deliberately inferred. expo-router bundles its own
 * copy of the react-navigation types, so importing BottomTabNavigationOptions
 * from @react-navigation/bottom-tabs produces a spurious mismatch.
 */
export function tabScreenOptions(c: Palette, accent: string) {
  return {
    headerShown: false,
    tabBarActiveTintColor: accent,
    tabBarInactiveTintColor: c.inkFaint,
    tabBarStyle: {
      backgroundColor: c.surface,       // same ground as the page, not a slab
      borderTopColor: c.line,
      borderTopWidth: StyleSheet.hairlineWidth,
      height: 60,
      paddingTop: 8,
      paddingBottom: 8,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabBarLabelStyle: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 0 },
  } as const;
}

/** Normal tab icon. */
export function tabIcon(name: IconName) {
  return ({ color }: { color: ColorValue }) => <Icon name={name} size={19} color={String(color)} />;
}

/**
 * The centre action. Marked by an outline rather than a filled, floating
 * circle — a raised blob is the loudest thing on the screen and fights
 * everything above it.
 */
export function centreIcon(name: IconName, accent: string) {
  return () => (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -2,
      }}
    >
      <Icon name={name} size={15} color={accent} strokeWidth={2} />
    </View>
  );
}

/** Simple centred placeholder body for screens that aren't built yet. */
export function Stub({ text, c }: { text: string; c: Palette }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkFaint, textAlign: 'center', lineHeight: 19 }}>{text}</Text>
    </View>
  );
}
