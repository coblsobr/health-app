import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, StatusBar as RNStatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
// expo-router vendors its own react-navigation; this subpath is the sanctioned
// way to reach it. Importing from @react-navigation/* is a bundling error.
import { CommonActions } from 'expo-router/react-navigation';
import { useTheme } from '../theme/ThemeProvider';
import { Caps, Fig, Rule } from './fit';

/**
 * Fitness chrome.
 *
 * Nutrition wears a filled coloured app bar with a centred title. Fitness
 * deliberately has neither: the navigation is a black spine down the left edge
 * and the title is typographic, set flush left on the page itself. That single
 * move is what stops the two worlds reading as two tabs of one app.
 */

export const RAIL_W = 52;

/**
 * The spine. A numbered index of the section, the way a logbook's tabs are
 * numbered, rather than a row of icons along the bottom of the screen.
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
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: c.line,
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
          <View key={i} style={{ width: 17, height: 1.6, backgroundColor: '#fff' }} />
        ))}
      </Pressable>

      <View style={{ height: 1, backgroundColor: c.fitRule, marginHorizontal: 12, marginTop: 8 }} />

      <View style={{ flex: 1, paddingTop: 6 }}>
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
                paddingVertical: 11,
                alignItems: 'center',
                borderLeftWidth: 3,
                borderLeftColor: focused ? c.fit : 'transparent',
                backgroundColor: focused ? c.fitInkSoft : 'transparent',
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.fitMono,
                  fontSize: 8,
                  color: focused ? c.fit : c.fitDim,
                  marginBottom: 1,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.fitDisplay,
                  fontSize: 12,
                  letterSpacing: 0.4,
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
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 1.2,
            borderColor: c.fitDim,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.fitDisplay, fontSize: 12, color: '#fff' }}>C</Text>
        </View>
      </Pressable>
    </View>
  );
}

/**
 * A Fitness page. The masthead is flush left and reads as a header on a sheet
 * of paper: a small line of context, the name in condensed caps, a heavy rule
 * under it. No coloured bar, no centred title, no figure floating above it.
 */
export function FitScreen({
  eyebrow,
  title,
  right,
  children,
}: {
  eyebrow?: string;
  title: string;
  /** Sits on the masthead's baseline — a date, a total, a switcher. */
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <RNStatusBar barStyle="light-content" backgroundColor={c.fitInk} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 36,
        }}
        showsVerticalScrollIndicator={false}
      >
        {eyebrow ? (
          <Fig size={9} tone={c.fit} weight="semi" style={{ letterSpacing: 1.4, marginBottom: 2 }}>
            {eyebrow.toUpperCase()}
          </Fig>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Caps size={34} track={0.2} style={{ flex: 1, marginBottom: -3 }} numberOfLines={1}>
            {title.toUpperCase()}
          </Caps>
          {typeof right === 'string' ? (
            <Fig size={11} tone={c.inkFaint}>
              {right}
            </Fig>
          ) : (
            right
          )}
        </View>

        <Rule strong style={{ marginTop: 7 }} />

        {children}
      </ScrollView>
    </View>
  );
}
