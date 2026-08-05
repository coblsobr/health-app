import { View, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, Sm, Xs, Prog, Chip } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

type Item = { name: string; kcal: number; note?: string };

const MEALS: { meal: string; total: number; items: Item[] }[] = [
  { meal: 'Breakfast', total: 412, items: [
    { name: 'Greek yogurt + berries', kcal: 248 },
    { name: 'Black coffee', kcal: 5 },
    { name: 'Banana', kcal: 159 },
  ]},
  { meal: 'Lunch', total: 686, items: [
    { name: 'Chicken Tortilla Soup', kcal: 521, note: 'from your library · 1 serving' },
    { name: 'Tortilla chips (12)', kcal: 165 },
  ]},
  { meal: 'Snacks', total: 726, items: [
    { name: 'Chipotle chicken bowl', kcal: 640, note: 'restaurant · matched from menu database' },
    { name: 'Almonds, 1 oz', kcal: 86 },
  ]},
];

export default function Diary() {
  const { c, fonts } = useTheme();
  return (
    <Screen title="Diary" subtitle="Mon, Aug 3 · 1,824 / 2,466">
      <View style={{ marginBottom: 12 }}><Prog pct={74} /></View>

      {MEALS.map((m) => (
        <Card key={m.meal} style={{ paddingVertical: 10 }}>
          <Ch right={<Text style={{ fontFamily: fonts.bold, fontSize: 10, color: c.ink }}>{m.total}</Text>}>{m.meal}</Ch>
          {m.items.map((it) => (
            <View key={it.name}>
              <Row style={{ paddingVertical: 3 }}>
                <Sm style={{ color: c.ink, flex: 1 }}>{it.name}</Sm>
                <Xs>{it.kcal}</Xs>
              </Row>
              {it.note ? <Xs style={{ marginBottom: 4 }}>{it.note}</Xs> : null}
            </View>
          ))}
        </Card>
      ))}

      <Card style={{ borderStyle: 'dashed', paddingVertical: 14, alignItems: 'center' }}>
        <Sm>
          Dinner — <Text style={{ fontFamily: fonts.bold, color: c.nut }}>980 cal available</Text>
        </Sm>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        <Chip label="+ Quick add" on />
        <Chip label="+ From library" />
        <Chip label="+ Restaurant" />
        <Chip label="+ Barcode" />
      </View>
    </Screen>
  );
}
