import { View, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card, Row, Sm, Xs, Btn, Toast, B } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

const WEEK: [string, number, string, string, 'strength' | 'cardio' | 'rest'][] = [
  ['Mon', 4, 'Push — Chest & Triceps', '50 min · ~420 cal · gym', 'strength'],
  ['Tue', 5, 'Rowing intervals', '25 min · ~280 cal · gym', 'cardio'],
  ['Wed', 6, 'Rest day', '', 'rest'],
  ['Thu', 7, 'Pull — Back & Biceps', '50 min · ~400 cal · gym', 'strength'],
  ['Fri', 8, 'Legs — Squat focus', '55 min · ~480 cal · gym', 'strength'],
  ['Sat', 9, 'Long walk / hike', '60 min · ~300 cal · outdoors', 'cardio'],
];

export default function FitnessPlan() {
  const { c, fonts } = useTheme();
  return (
    <Screen title="Training week" subtitle="Aug 4 – 10 · built for fat loss">
      <Toast>Built from what you like: <B>no running</B>, gym 4×/week, bench & squat favoured.</Toast>

      {WEEK.map(([d, n, name, meta, kind]) => (
        <Row key={d} style={{ alignItems: 'flex-start', gap: 9, marginBottom: 9 }}>
          <View style={{ width: 34, alignItems: 'center', paddingTop: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: c.inkFaint, textTransform: 'uppercase' }}>{d}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: c.ink }}>{n}</Text>
          </View>
          <Row
            style={{
              flex: 1, backgroundColor: c.card, borderColor: c.line, borderWidth: 1,
              borderStyle: kind === 'rest' ? 'dashed' : 'solid',
              borderRadius: 13, paddingVertical: 8, paddingHorizontal: 10, gap: 8,
              justifyContent: kind === 'rest' ? 'center' : 'space-between',
            }}
          >
            {kind === 'rest' ? (
              <Xs>Rest day</Xs>
            ) : (
              <>
                <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, backgroundColor: kind === 'strength' ? c.fit : c.info }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.ink }} numberOfLines={1}>{name}</Text>
                  <Xs>{meta}</Xs>
                </View>
                <Text style={{ fontSize: 13, color: c.inkFaint }}>✕</Text>
              </>
            )}
          </Row>
        </Row>
      ))}

      <Card style={{ paddingVertical: 10 }}>
        <Row><Sm>Week total burn</Sm><Text style={{ fontFamily: fonts.displayBold, fontSize: 13, color: c.fit }}>~1,880 cal</Text></Row>
        <Row style={{ marginTop: 3 }}><Sm>Adds to food budget</Sm><Text style={{ fontFamily: fonts.displayBold, fontSize: 11, color: c.nut }}>+269 / day</Text></Row>
      </Card>

      <Btn label="↻ Rebuild the week" tone="fit" />
    </Screen>
  );
}
