import { View, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, Xs, Sm, Divider } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

const HISTORY = [
  { day: 'Sun Aug 2', icon: '🏃', name: 'Morning Run', meta: '4.28 mi · 38:12 · 8:56 pace', cal: '482' },
  { day: 'Sat Aug 1', icon: '🏋️', name: 'Legs — Squat focus', meta: '55 min · 5 exercises', cal: '478' },
  { day: 'Fri Jul 31', icon: '🚴', name: 'Evening ride', meta: '11.2 mi · 42:08', cal: '396' },
  { day: 'Thu Jul 30', icon: '🏋️', name: 'Pull — Back & Biceps', meta: '50 min · 6 exercises', cal: '401' },
];

export default function History() {
  const { c, fonts } = useTheme();
  return (
    <Screen title="History" subtitle="Last 30 days">
      <Card>
        <Ch>Recent sessions</Ch>
        {HISTORY.map((h, i) => (
          <View key={h.name + h.day}>
            {i ? <Divider style={{ marginVertical: 3 }} /> : null}
            <Xs style={{ marginTop: 4 }}>{h.day}</Xs>
            <Row style={{ paddingVertical: 6, gap: 9 }}>
              <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 15 }}>{h.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semi, fontSize: 12, color: c.ink }}>{h.name}</Text>
                <Xs>{h.meta}</Xs>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: 12, color: c.fit }}>{h.cal}</Text>
                <Xs>cal</Xs>
              </View>
            </Row>
          </View>
        ))}
      </Card>
      <Sm style={{ textAlign: 'center' }}>Tapping a session will open the map + HR detail view.</Sm>
    </Screen>
  );
}
