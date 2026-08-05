import React from 'react';
import { View, Text, type ColorValue } from 'react-native';
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
      backgroundColor: c.card,
      borderTopColor: c.line,
      borderTopWidth: 1,
      height: 62,
      paddingTop: 6,
      paddingBottom: 8,
    },
    tabBarLabelStyle: { fontFamily: fonts.semi, fontSize: 8.6 },
  } as const;
}

/** Normal tab icon. */
export function tabIcon(name: IconName) {
  return ({ color }: { color: ColorValue }) => <Icon name={name} size={19} color={String(color)} />;
}

/** The raised centre action (Add / Log). */
export function centreIcon(name: IconName, accent: string) {
  return () => (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -4,
        shadowColor: accent,
        shadowOpacity: 0.45,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }}
    >
      <Icon name={name} size={19} color="#fff" strokeWidth={2.7} />
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
