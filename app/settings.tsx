import { View, Text, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { Card, Ch, Row, Sm, Xs } from '../components/ui';
import { Icon } from '../components/Icon';
import { useTheme, type ThemeMode } from '../theme/ThemeProvider';

const GROUPS: { title: string; rows: [string, string][] }[] = [
  { title: 'Nutrition', rows: [
    ['Diet & restrictions', 'Not set'],
    ['Ingredient preferences', '0 set'],
    ['Shopping rules', 'Meijer'],
    ['Pantry & expiry alerts', 'Off'],
  ]},
  { title: 'Fitness', rows: [
    ['Connected apps', 'None yet'],
    ['Exercise preferences', ''],
    ['Units', 'lb · mi'],
  ]},
  { title: 'App', rows: [
    ['Account & sync', ''],
    ['Export my data', 'JSON'],
    ['Check for updates', 'v0.1.0'],
  ]},
];

export default function Settings() {
  const { c, fonts, mode, setMode } = useTheme();

  const modes: ThemeMode[] = ['light', 'dark', 'system'];

  return (
    <Screen title="Settings">
      {GROUPS.slice(0, 2).map((g) => (
        <View key={g.title}>
          <Ch>{g.title}</Ch>
          <Card>
            {g.rows.map(([label, value], i) => (
              <Row key={label} style={{ paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <Sm style={{ color: c.ink }}>{label}</Sm>
                <Row style={{ gap: 5 }}>
                  <Xs>{value}</Xs>
                  <Icon name="chevron" size={13} color={c.inkFaint} />
                </Row>
              </Row>
            ))}
          </Card>
        </View>
      ))}

      <Ch>Appearance</Ch>
      <Card>
        {/* This one is live — it actually retints the whole app. */}
        <View style={{ flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: 11, padding: 2.5, gap: 2, marginBottom: 10 }}>
          {modes.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 9,
                backgroundColor: mode === m ? c.card : 'transparent',
              }}
            >
              <Text style={{ fontFamily: fonts.semi, fontSize: 10, color: mode === m ? c.ink : c.inkSoft, textTransform: 'capitalize' }}>
                {m}
              </Text>
            </Pressable>
          ))}
        </View>
        <Row style={{ gap: 7, justifyContent: 'flex-start' }}>
          {[c.g1, c.g2, c.g6, c.g5, c.g3].map((g, i) => (
            <View
              key={i}
              style={{
                width: 32, height: 32, borderRadius: 10, backgroundColor: g[1],
                borderWidth: i === 0 ? 2.5 : 1, borderColor: i === 0 ? c.nut : c.line,
              }}
            />
          ))}
        </Row>
        <Xs style={{ marginTop: 7 }}>Accent colour · custom picker comes later</Xs>
      </Card>

      <Ch>{GROUPS[2].title}</Ch>
      <Card>
        {GROUPS[2].rows.map(([label, value], i) => (
          <Row key={label} style={{ paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Sm style={{ color: c.ink }}>{label}</Sm>
            <Row style={{ gap: 5 }}>
              <Xs>{value}</Xs>
              <Icon name="chevron" size={13} color={c.inkFaint} />
            </Row>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
