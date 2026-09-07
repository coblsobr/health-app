import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, StatusBar as RNStatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
// expo-router vendors its own react-navigation; this subpath is the sanctioned
// way to reach it. Importing from @react-navigation/* is a bundling error.
import { CommonActions } from 'expo-router/react-navigation';
import { useTheme } from '../theme/ThemeProvider';
import { Fig, T } from './fit';

/**
 * Fitness chrome.
 *
 * Nutrition wears a filled coloured app bar with a centred title. Fitness has
 * neither: navigation is a charcoal spine down the left edge and the title is
 * typographic, flush left on the page. The world also paints its own ground
 * (`fitPaper`) rather than borrowing Nutrition's warm cream — a cool accent on
 * warm paper was why the colours never looked settled.
 */

const HAIRLINE = StyleSheet.hairlineWidth;

export const RAIL_W = 50;

/**
 * The spine. A numbered index, the way a logbook's tabs are numbered.
 *
 * Typed loosely on purpose: expo-router vendors its own copy of the
 * react-navigation types, and importing BottomTabBarProps from
 * @react-navigation/bottom-tabs is a hard bundling error as of SDK 56.
 */
export function FitRail({ state, descriptors, navigation }: any) {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const drawer = useNavigation();
  const router = useRouter();

  return (
    <View
      style={{
        width: RAIL_W,
        backgroundColor: c.fitInk,
        // In dark mode the spine and the page are both nearly black, so the
        // separation has to come from a rule rather than from contrast alone.
        borderRightWidth: HAIRLINE,
        borderRightColor: c.fitLine,
        paddingTop: insets.top + 10,
        paddingBottom: insets.bottom + 12,
      }}
    >
      <Pressable
        // Raw action rather than DrawerActions.openDrawer(): expo-router no
        // longer allows importing from @react-navigation/*, and that helper
        // only ever returned this object.
        onPress={() => drawer.dispatch({ type: 'OPEN_DRAWER' })}
        hitSlop={12}
        accessibilityLabel="Open sections menu"
        accessibilityRole="button"
        style={{ alignItems: 'center', paddingVertical: 10, gap: 4 }}
      >
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 16, height: 1.5, backgroundColor: '#fff' }} />
        ))}
      </Pressable>

      <View style={{ height: HAIRLINE, backgroundColor: c.fitRule, marginHorizontal: 13, marginTop: 9 }} />

      <View style={{ flex: 1, paddingTop: 8 }}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label: string = options.title ?? route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                // dispatch with an explicit target, not navigation.navigate():
                // a navigator's own navigation object navigates in its PARENT,
                // so navigate() here asked the Drawer for a route it does not
                // have and silently did nothing.
                if (!focused && !event.defaultPrevented) {
                  navigation.dispatch({ ...CommonActions.navigate(route), target: state.key });
                }
              }}
              style={{
                paddingVertical: 12,
                alignItems: 'center',
                borderLeftWidth: 2,
                borderLeftColor: focused ? c.fit : 'transparent',
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.fitMonoLight,
                  fontSize: 8,
                  color: focused ? c.fit : c.fitDim,
                  marginBottom: 2,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.fitLabel,
                  fontSize: 9.5,
                  letterSpacing: 0.9,
                  color: focused ? '#fff' : c.fitDim,
                }}
              >
                {label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push('/profile')}
        hitSlop={12}
        accessibilityLabel="Profile"
        accessibilityRole="button"
        style={{ alignItems: 'center' }}
      >
        <View
          style={{
            width: 25,
            height: 25,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: c.fitDim,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.fitLabel, fontSize: 10.5, color: '#fff' }}>C</Text>
        </View>
      </Pressable>
    </View>
  );
}

/**
 * A Fitness page. Masthead flush left, a rule under it, then the page. No
 * coloured bar, no centred title, no figure floating above anything.
 */
export function FitScreen({
  eyebrow,
  title,
  right,
  children,
}: {
  eyebrow?: string;
  title: string;
  /** Sits on the masthead's baseline — a date range, a count. */
  right?: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: c.fitPaper }}>
      <RNStatusBar barStyle="light-content" backgroundColor={c.fitInk} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {eyebrow ? (
          <Fig size={9} tone={c.fit} style={{ letterSpacing: 1.5, marginBottom: 5 }}>
            {eyebrow.toUpperCase()}
          </Fig>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <T size={26} weight="heavy" style={{ letterSpacing: -0.6 }} numberOfLines={1}>
            {title}
          </T>
          {right ? (
            <Fig size={10.5} weight="light" tone={c.fitTextFaint}>
              {right}
            </Fig>
          ) : null}
        </View>

        <View style={{ height: HAIRLINE, backgroundColor: c.fitLine, marginHorizontal: -16, marginTop: 13 }} />

        {children}
      </ScrollView>
    </View>
  );
}
