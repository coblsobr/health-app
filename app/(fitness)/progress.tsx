import { useState } from 'react';
import { View } from 'react-native';
import { FitScreen } from '../../components/fitChrome';
import { Label, MetaLine, Statement, Fig, T, Rule, Switcher, Note } from '../../components/fit';
import { useTheme } from '../../theme/ThemeProvider';

/** Sessions per week. The chart is the list — one bar per row, in place. */
const WEEKS: [string, number][] = [
  ['W32', 5],
  ['W31', 4],
  ['W30', 6],
  ['W29', 3],
  ['W28', 5],
  ['W27', 2],
];

const BESTS: [string, string][] = [
  ['Bench press', '185 × 5'],
  ['Back squat', '245 × 5'],
  ['Deadlift', '315 × 3'],
  ['Fastest mile', '8:39'],
];

export default function Progress() {
  const { c } = useTheme();
  const [span, setSpan] = useState(1);
  const peak = Math.max(...WEEKS.map((w) => w[1]));

  return (
    <FitScreen eyebrow="Training" title="Trend">
      <Statement lead="Averaging" value="4.2" trail="sessions a week" />
      <MetaLine>17 this month · 9h 24m · 7,120 cal</MetaLine>

      <Label right={<Switcher options={['Wk', 'Mo', '6mo', 'Yr']} active={span} onChange={setSpan} />}>
        By week
      </Label>
      {WEEKS.map(([label, n]) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', height: 26, gap: 11 }}>
          <Fig size={9.5} weight="light" tone={c.fitTextFaint} style={{ width: 26 }}>
            {label}
          </Fig>
          <View style={{ flex: 1 }}>
            <View
              style={{ height: 9, width: `${Math.round((n / peak) * 100)}%`, backgroundColor: c.fit }}
            />
          </View>
          <Fig size={11} weight="med" style={{ width: 14, textAlign: 'right' }}>
            {n}
          </Fig>
        </View>
      ))}

      <Label>Bests</Label>
      {BESTS.map(([lift, v]) => (
        <View key={lift}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', height: 30, gap: 10 }}>
            <T size={13.5} weight="label" style={{ flex: 1 }}>
              {lift}
            </T>
            <Fig size={12.5} weight="med">
              {v}
            </Fig>
          </View>
          <Rule />
        </View>
      ))}

      <Note>Bests will come from logged sets, not from the watch.</Note>
    </FitScreen>
  );
}
