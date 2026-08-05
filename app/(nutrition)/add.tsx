import { View, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card, Row, Sm, Xs } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { useTheme } from '../../theme/ThemeProvider';

export default function Add() {
  const { c, fonts } = useTheme();

  const paths: { icon: IconName; bg: string; title: string; sub: string }[] = [
    { icon: 'globe', bg: c.tagC[0], title: 'Browse & grab', sub: 'Open a site, tap Save — like Paprika' },
    { icon: 'link', bg: c.tagD[0], title: 'Paste a link', sub: 'Or share to the app from anywhere' },
    { icon: 'camera', bg: c.tagE[0], title: 'Photo or screenshot', sub: 'Cookbook, Instagram, index card' },
    { icon: 'pencil', bg: c.tagA[0], title: 'Type it in', sub: 'Blank form' },
  ];

  return (
    <Screen title="Add a recipe">
      {paths.map((p) => (
        <Card key={p.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={p.icon} size={18} color={c.inkSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 12.5, color: c.ink }}>{p.title}</Text>
            <Sm>{p.sub}</Sm>
          </View>
          <Icon name="chevron" size={15} color={c.inkFaint} />
        </Card>
      ))}

      <Card style={{ marginTop: 6, alignItems: 'center', paddingVertical: 18 }}>
        <Xs style={{ textAlign: 'center', lineHeight: 17 }}>
          None of these are wired up yet.{'\n'}Website import lands in Phase 2, photo/OCR in the same phase.
        </Xs>
      </Card>
    </Screen>
  );
}
