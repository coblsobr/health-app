import { View, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card, Row, Sm, Xs, H3, Chip, Tag, Photo, type TagTone } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme/ThemeProvider';

const FILTERS = ['All', '♥ Faves', 'Vegan', 'Low sodium', 'Anti-inflam.', 'High protein', '< 30 min', '< $3/serv'];

type R = { name: string; tags: [string, TagTone][]; time: string; rating: string; kcal: string; cost: string; g: 0 | 1 };

const RECIPES: R[] = [
  { name: 'Sheet-Pan Salmon & Broccoli', tags: [['HIGH PROTEIN', 'E'], ['ANTI-INFLAM', 'D']], time: '⏱ 28 min · 4 serv', rating: '9/10', kcal: '486 cal', cost: '$3.85 / serving', g: 0 },
  { name: 'Coconut Red Lentil Curry', tags: [['VEGAN', 'B'], ['LOW SODIUM', 'C']], time: '⏱ 35 min · 6 serv', rating: '8/10', kcal: '412 cal', cost: '$1.94 / serving', g: 1 },
];

export default function Library() {
  const { c, fonts } = useTheme();
  return (
    <Screen title="Library" subtitle="0 recipes saved">
      <Row style={{ backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 13, padding: 9, marginBottom: 10, gap: 8, justifyContent: 'flex-start' }}>
        <Icon name="search" size={15} color={c.inkFaint} />
        <Sm>Search recipes & ingredients</Sm>
      </Row>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 11 }}>
        {FILTERS.map((f, i) => <Chip key={f} label={f} on={i === 0} />)}
      </View>

      {RECIPES.map((r) => (
        <Card key={r.name} style={{ padding: 0, overflow: 'hidden' }}>
          <Photo g={r.g === 0 ? c.g1 : c.g2}>
            <Row style={{ gap: 4, justifyContent: 'flex-start' }}>
              {r.tags.map(([label, tone]) => <Tag key={label} label={label} tone={tone} />)}
            </Row>
          </Photo>
          <View style={{ padding: 11 }}>
            <H3>{r.name}</H3>
            <Row style={{ marginTop: 6 }}>
              <Xs>{r.time}</Xs>
              <View style={{ backgroundColor: c.goldSoft, borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 }}>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: 10, color: c.gold }}>{r.rating}</Text>
              </View>
            </Row>
            <Row style={{ marginTop: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 9.5, color: c.nut }}>{r.kcal}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 9.5, color: c.fit }}>{r.cost}</Text>
            </Row>
          </View>
        </Card>
      ))}

      <Sm style={{ textAlign: 'center', marginTop: 10 }}>Two sample cards — real recipes arrive in Phase 1.</Sm>
    </Screen>
  );
}
