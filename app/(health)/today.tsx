import { View, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { Ring } from '../../components/Ring';
import { Card, Ch, Row, Sm, Xs, Tile, Prog, Toast, B, Divider } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

export default function HealthToday() {
  const { c, fonts } = useTheme();

  const Macro = ({ label, have, need, tone }: { label: string; have: number; need: number; tone: 'info' | 'gold' | 'nut' }) => (
    <View style={{ marginBottom: 7 }}>
      <Row style={{ marginBottom: 3 }}>
        <Text style={{ fontFamily: fonts.semi, fontSize: 10, color: c.inkSoft }}>{label}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: c.ink }}>{have} / {need} g</Text>
      </Row>
      <Prog pct={(have / need) * 100} tone={tone} thin />
    </View>
  );

  return (
    <Screen title="Health" subtitle="Monday, Aug 3">
      <Card style={{ paddingVertical: 14 }}>
        <Ring value="642" label="CALORIES LEFT" pct={0.68} accent={c.nut} />
        <Divider />
        <Row>
          {[
            ['1,824', 'Eaten', c.nut],
            ['+ 566', 'Burned', c.fit],
            ['3,032', 'Budget', c.ink],
          ].map(([v, l, col], i) => (
            <View key={l as string} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: c.line }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: col as string, letterSpacing: -0.5 }}>{v}</Text>
              <Xs>{l}</Xs>
            </View>
          ))}
        </Row>
      </Card>

      <Toast>
        <B>Big lift today.</B> You earned 566 cal back — dinner budget bumped to <B>980 cal</B>.
      </Toast>

      <Card>
        <Ch>Macros</Ch>
        <Macro label="Protein" have={112} need={165} tone="info" />
        <Macro label="Carbs" have={186} need={280} tone="gold" />
        <Macro label="Fat" have={58} need={82} tone="nut" />
      </Card>

      <Row style={{ gap: 8 }}>
        <Tile value="9,241" label="Steps" />
        <Tile value="62" unit=" bpm" label="Resting HR" />
        <Tile value="198" unit=" lb" label="Weight" />
      </Row>

      <Sm style={{ marginTop: 14, textAlign: 'center' }}>Placeholder figures — nothing is wired to real data yet.</Sm>
    </Screen>
  );
}
