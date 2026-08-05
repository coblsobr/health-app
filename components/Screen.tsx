import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

/**
 * Every screen in the app is wrapped in this: hamburger top-left,
 * title centred, profile avatar top-right. Body scrolls beneath.
 */
export function Screen({
  title,
  subtitle,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();

  const Body = scroll ? ScrollView : View;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
      {/* app bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 15,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        <Pressable
          // Raw action rather than DrawerActions.openDrawer(): expo-router no
          // longer allows importing from @react-navigation/* (SDK 56+), and
          // that helper only ever returned this object.
          onPress={() => navigation.dispatch({ type: 'OPEN_DRAWER' })}
          hitSlop={12}
          style={{ width: 32, height: 32, justifyContent: 'center', gap: 4.5 }}
          accessibilityLabel="Open sections menu"
          accessibilityRole="button"
        >
          <View style={{ width: 19, height: 2.3, borderRadius: 2, backgroundColor: c.ink }} />
          <View style={{ width: 19, height: 2.3, borderRadius: 2, backgroundColor: c.ink }} />
          <View style={{ width: 19, height: 2.3, borderRadius: 2, backgroundColor: c.ink }} />
        </Pressable>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 19, color: c.ink, letterSpacing: -0.4 }}>{title}</Text>
          {subtitle ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: c.inkSoft, marginTop: 1 }}>{subtitle}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => router.push('/profile')}
          hitSlop={12}
          accessibilityLabel="Profile"
          accessibilityRole="button"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: c.cardAlt,
            borderWidth: 1.5,
            borderColor: c.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="person" size={18} color={c.inkFaint} />
        </Pressable>
      </View>

      <Body
        style={{ flex: 1 }}
        contentContainerStyle={scroll ? { paddingHorizontal: 14, paddingBottom: 24 } : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Body>
    </View>
  );
}
