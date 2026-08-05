import { View, Text } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Screen } from '../../components/Screen';
import { Ring } from '../../components/Ring';
import { Card, Ch, Row, Sm, Xs, Divider } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

const SESSIONS = [
  { icon: '🏋️', name: 'Push Day — Chest & Tri', meta: '6:12 AM · 48 min · 6 exercises', cal: '412' },
  { icon: '🚶', name: 'Evening walk', meta: '7:40 PM · 32 min · 1.7 mi', cal: '154' },
];

export default function FitnessToday() {
  const { c, fonts } = useTheme();
  return (
    <Screen title="Fitness" subtitle="Monday, Aug 3">
      <Card style={{ paddingVertical: 14 }}>
        <Ring value="566" label="CAL BURNED" pct={0.82} accent={c.fit} />
        <Divider />
        <Row>
          {[['9,241', 'Steps'], ['54 min', 'Active'], ['4.1 mi', 'Distance']].map(([v, l]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: c.ink, letterSpacing: -0.5 }}>{v}</Text>
              <Xs>{l}</Xs>
            </View>
          ))}
        </Row>
      </Card>

      <Card>
        <Ch>Today's sessions</Ch>
        {SESSIONS.map((s, i) => (
          <View key={s.name}>
            {i ? <Divider style={{ marginVertical: 3 }} /> : null}
            <Row style={{ paddingVertical: 8, gap: 9 }}>
              <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 15 }}>{s.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semi, fontSize: 12, color: c.ink }}>{s.name}</Text>
                <Xs>{s.meta}</Xs>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: 12, color: c.fit }}>{s.cal}</Text>
                <Xs>cal</Xs>
              </View>
            </Row>
          </View>
        ))}
      </Card>

      <Card>
        <Ch>Heart rate</Ch>
        <Svg width="100%" height={56} viewBox="0 0 250 56">
          <Polyline
            points="4,44 20,42 34,26 46,16 58,22 70,14 84,20 96,12 110,24 124,40 140,42 156,38 172,30 186,34 200,41 216,43 232,39 246,44"
            fill="none" stroke={c.nut} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
        <Row><Xs>Resting 62</Xs><Xs>Avg 118</Xs><Xs>Peak 164</Xs></Row>
      </Card>

      <Sm style={{ textAlign: 'center', marginTop: 10 }}>Health Connect wiring lands in Phase 8 — these are placeholders.</Sm>
    </Screen>
  );
}
