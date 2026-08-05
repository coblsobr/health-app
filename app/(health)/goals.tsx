import { View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, Sm, Xs, KV, Chip, Seg, Toggle, Toast, B, Divider } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

const GOALS = ['🔥 Lose fat', '💪 Build muscle', '⚖️ Maintain', '🔁 Recomp', '🏃 Endurance'];

export default function Goals() {
  const { c } = useTheme();
  return (
    <Screen title="Goals">
      <Card>
        <Ch>What are you after?</Ch>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {GOALS.map((g, i) => <Chip key={g} label={g} on={i === 0} />)}
        </View>
      </Card>

      <Card>
        <Ch>Pace</Ch>
        <Seg options={['0.5 lb', '1 lb', '1.5 lb', '2 lb']} active={1} />
        <Sm style={{ marginTop: 8 }}>per week · a 500 cal/day deficit</Sm>
        <Divider />
        <KV k="Target weight" v="178 lb" />
        <KV k="Est. arrival" v="Dec 14, 2026" sub />
      </Card>

      <Card>
        <Ch>Your numbers</Ch>
        <KV k="Maintenance (TDEE)" v="2,966" />
        <KV k="Daily target" v="2,466" />
        <Divider />
        <KV k="Protein" v="165 g" sub />
        <KV k="Carbs" v="280 g" sub />
        <KV k="Fat" v="82 g" sub />
      </Card>

      <Card style={{ paddingVertical: 10 }}>
        <Row>
          <View>
            <Sm style={{ color: c.ink }}>Eat back exercise calories</Sm>
            <Xs>Budget grows on training days</Xs>
          </View>
          <Toggle on tone="hlth" />
        </Row>
      </Card>

      <Toast>Goals feed <B>both</B> planners — meals and workouts get picked to match.</Toast>
    </Screen>
  );
}
