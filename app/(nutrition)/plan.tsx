import { View, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, Sm, Xs, Seg, Btn, Stepper, Toggle, KV } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

const DAYS = [
  { d: 'Mon', n: 4, meals: [['Overnight oats', 'Breakfast · 340 cal', false], ['Crispy Gnocchi, Tomatoes', 'Dinner · 508 cal · NEW', true]] },
  { d: 'Tue', n: 5, meals: [['Greek yogurt bowl', 'Breakfast · 290 cal', false], ['Red Lentil Curry', 'Dinner · 412 cal', false]] },
  { d: 'Wed', n: 6, meals: [['Curry leftovers', 'Lunch · 412 cal', false], ['Miso Glazed Eggplant', 'Dinner · 386 cal · NEW', true]] },
];

export default function Plan() {
  const { c, fonts } = useTheme();
  return (
    <Screen title="This week" subtitle="Aug 4 – 10 · est. $112">
      <View style={{ marginBottom: 11 }}><Seg options={['List', 'Calendar']} active={0} /></View>

      {DAYS.map((day) => (
        <Row key={day.d} style={{ alignItems: 'flex-start', gap: 9, marginBottom: 9 }}>
          <View style={{ width: 34, alignItems: 'center', paddingTop: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: c.inkFaint, textTransform: 'uppercase' }}>{day.d}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: c.ink }}>{day.n}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {day.meals.map(([name, meta, isNew]) => (
              <Row
                key={name as string}
                style={{
                  backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 13,
                  paddingVertical: 8, paddingHorizontal: 10, marginBottom: 5, gap: 8,
                }}
              >
                <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, backgroundColor: isNew ? c.gold : c.nut }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.semi, fontSize: 11.5, color: c.ink }} numberOfLines={1}>{name as string}</Text>
                  <Xs>{meta as string}</Xs>
                </View>
                <Text style={{ fontSize: 13, color: c.inkFaint }}>✕</Text>
              </Row>
            ))}
          </View>
        </Row>
      ))}

      <Card>
        <Ch>Generator settings</Ch>
        <Row style={{ paddingVertical: 5 }}><Sm>Feeding</Sm><Stepper value={2} /></Row>
        <Row style={{ paddingVertical: 5 }}><Sm>From your library</Sm><Stepper value={4} /></Row>
        <Row style={{ paddingVertical: 5 }}><Sm>New to try</Sm><Stepper value={3} /></Row>
        <Row style={{ paddingVertical: 5 }}><Sm>Use up pantry first</Sm><Toggle on /></Row>
        <KV k="Weekly budget" v="$120" />
      </Card>

      <Row style={{ gap: 8 }}>
        <Btn label="↻ Reshuffle" ghost style={{ flex: 1 }} />
        <Btn label="Grocery list ›" style={{ flex: 1 }} />
      </Row>
    </Screen>
  );
}
