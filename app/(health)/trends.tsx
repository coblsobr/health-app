import { View } from 'react-native';
import Svg, { Polyline, Circle, Rect, Line } from 'react-native-svg';
import { Screen } from '../../components/Screen';
import { Card, Ch, Row, Xs, KV, Seg } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

const EATEN = [26, 32, 22, 36, 27, 19, 30, 24, 34, 25];
const BURNED = [14, 24, 9, 28, 11, 7, 26, 15, 30, 12];

export default function Trends() {
  const { c } = useTheme();
  return (
    <Screen title="Trends">
      <View style={{ marginBottom: 10 }}>
        <Seg options={['Week', 'Month', '6 mo', 'Year']} active={1} />
      </View>

      <Card>
        <Ch>In vs. out</Ch>
        <Svg width="100%" height={84} viewBox="0 0 250 84">
          <Line x1={0} y1={46} x2={250} y2={46} stroke={c.track} strokeWidth={1} strokeDasharray="3 3" />
          {EATEN.map((h, i) => (
            <Rect key={`e${i}`} x={6 + i * 24} y={46 - h} width={9} height={h} rx={2.5} fill={c.nut} />
          ))}
          {BURNED.map((h, i) => (
            <Rect key={`b${i}`} x={6 + i * 24} y={46} width={9} height={h} rx={2.5} fill={c.fit} />
          ))}
        </Svg>
        <Row style={{ justifyContent: 'center', gap: 16, marginTop: 4 }}>
          <Row style={{ gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: c.nut }} />
            <Xs>Eaten</Xs>
          </Row>
          <Row style={{ gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: c.fit }} />
            <Xs>Burned</Xs>
          </Row>
        </Row>
      </Card>

      <Card>
        <Ch>Weight</Ch>
        <Svg width="100%" height={62} viewBox="0 0 250 62">
          <Polyline
            points="6,12 32,16 58,13 84,22 110,26 136,24 162,33 188,37 214,35 240,44"
            fill="none" stroke={c.hlth} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
          />
          <Circle cx={240} cy={44} r={3.8} fill={c.hlth} />
        </Svg>
        <Row><Xs>Jul 4</Xs><Xs>Aug 3</Xs></Row>
      </Card>

      <Card>
        <Ch>This month</Ch>
        <KV k="Avg. daily net" v="2,318 cal" />
        <KV k="Workouts" v="17 sessions" />
        <KV k="Days on target" v="24 / 31" />
        <KV k="Avg. grocery spend" v="$104 / wk" />
      </Card>
    </Screen>
  );
}
