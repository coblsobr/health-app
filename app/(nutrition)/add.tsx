import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card, Sm, Xs } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { useTheme } from '../../theme/ThemeProvider';

export default function Add() {
  const { c, fonts } = useTheme();
  const router = useRouter();

  const paths: { icon: IconName; bg: string; title: string; sub: string; ready: boolean; href: string }[] = [
    { icon: 'link', bg: c.tagD[0], title: 'Paste a link', sub: 'Pull a recipe off any cooking site', ready: true, href: '/recipe/import' },
    { icon: 'pencil', bg: c.tagA[0], title: 'Type it in', sub: 'Enter a recipe by hand', ready: true, href: '/recipe/new' },
    { icon: 'globe', bg: c.tagC[0], title: 'Browse & grab', sub: 'Coming next', ready: false, href: '' },
    { icon: 'camera', bg: c.tagE[0], title: 'Photo or screenshot', sub: 'Cookbook page, screenshot, index card', ready: true, href: '/recipe/scan' },
  ];

  return (
    <Screen title="Add a recipe">
      {paths.map((p) => (
        <Pressable key={p.title} onPress={p.ready ? () => router.push(p.href as never) : undefined} disabled={!p.ready}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: p.ready ? 1 : 0.5 }}>
            <View
              style={{
                width: 38, height: 38, borderRadius: 13, backgroundColor: p.bg,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name={p.icon} size={18} color={c.inkSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 12.5, color: c.ink }}>{p.title}</Text>
              <Sm>{p.sub}</Sm>
            </View>
            <Icon name="chevron" size={15} color={c.inkFaint} />
          </Card>
        </Pressable>
      ))}

      <Xs style={{ textAlign: 'center', marginTop: 8, lineHeight: 17 }}>
        Manual entry works now and saves to your phone.{'\n'}The three import paths arrive next.
      </Xs>
    </Screen>
  );
}
