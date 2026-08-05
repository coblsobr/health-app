import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, KV, Seg, Tile } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

const BARS = [28, 42, 19, 51, 34, 12, 46, 30, 55, 24, 38, 44];

export default function Progress() {
  const { c } = useTheme();
  return (
    <Screen title="Progress">
      <View style={{ marginBottom: 10 }}><Seg options={['Week', 'Month', '6 mo', 'Year']} active={1} /></View>

      <Row style={{ gap: 8, marginBottom: 10 }}>
        <Tile value="17" label="Sessions" />
        <Tile value="9.4" unit=" hr" label="Time" />
        <Tile value="7,120" label="Calories" />
      </Row>

      <Card>
        <Ch>Sessions per week</Ch>
        <Svg width="100%" height={70} viewBox="0 0 250 70">
          {BARS.map((h, i) => (
            <Rect key={i} x={6 + i * 20} y={62 - h} width={11} height={h} rx={3} fill={c.fit} />
          ))}
        </Svg>
      </Card>

      <Card>
        <Ch>Personal bests</Ch>
        <KV k="Bench press" v="185 lb × 5" />
        <KV k="Back squat" v="245 lb × 5" />
        <KV k="Deadlift" v="315 lb × 3" />
        <KV k="Fastest mile" v="8:39" />
      </Card>
    </Screen>
  );
}
