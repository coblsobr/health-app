import { useState } from 'react';
import { View } from 'react-native';
import { FitScreen } from '../../components/fitChrome';
import { Head, Line, Switcher, Fig, Caps, Note, Rule } from '../../components/fit';
import { useTheme } from '../../theme/ThemeProvider';

/** Sessions per week. The chart is the table — one bar per row, in place. */
const WEEKS: [string, number, string][] = [
  ['W 32', 5, '4h 10m'],
  ['W 31', 4, '3h 25m'],
  ['W 30', 6, '5h 02m'],
  ['W 29', 3, '2h 18m'],
  ['W 28', 5, '4h 44m'],
  ['W 27', 2, '1h 36m'],
  ['W 26', 4, '3h 51m'],
  ['W 25', 5, '4h 07m'],
];

const PBS: [string, string, string][] = [
  ['Bench press', '185', 'lb × 5'],
  ['Back squat', '245', 'lb × 5'],
  ['Deadlift', '315', 'lb × 3'],
  ['Overhead press', '115', 'lb × 5'],
  ['Fastest mile', '8:39', 'min'],
  ['Longest ride', '18.4', 'mi'],
];

export default function Progress() {
  const { c } = useTheme();
  const [span, setSpan] = useState(1);
  const peak = Math.max(...WEEKS.map((w) => w[1]));

  return (
    <FitScreen eyebrow="Training log" title="Trend" right="since jan">
      <Head right={<Switcher options={['Wk', 'Mo', '6mo', 'Yr']} active={span} onChange={setSpan} />}>
        Totals
      </Head>
      <Line label="Sessions" value="17" sub="this month" />
      <Line label="Time" value="9:24" unit="hr" sub="this month" />
      <Line label="Burned" value="7,120" unit="cal" sub="this month" />
      <Line label="Per week" value="4.2" unit="sessions" sub="average" />

      <Head right="sessions">By week</Head>
      {WEEKS.map(([label, n, time]) => (
        <View key={label}>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 30, gap: 10 }}>
            <Fig size={10.5} tone={c.inkSoft} style={{ width: 78 }}>
              {label}
            </Fig>
            {/* The bar gets its own flexing column so the duration beside it
                keeps a fixed width and never wraps mid-figure. */}
            <View style={{ flex: 1 }}>
              <View style={{ height: 11, width: `${Math.round((n / peak) * 100)}%`, backgroundColor: c.fit }} />
            </View>
            <Fig size={9} tone={c.inkFaint} style={{ width: 46 }}>
              {time}
            </Fig>
            <Fig size={13.5} weight="semi" style={{ minWidth: 76, textAlign: 'right' }}>
              {n}
            </Fig>
          </View>
          <Rule />
        </View>
      ))}

      <Head right="best">Personal bests</Head>
      {PBS.map(([lift, v, unit]) => (
        <View key={lift}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', height: 30, gap: 10 }}>
            <Caps size={14} track={0.4} style={{ flex: 1 }}>
              {lift}
            </Caps>
            <Fig size={13.5} weight="semi">
              {v}
            </Fig>
            <Fig size={9} tone={c.inkFaint} style={{ width: 46 }}>
              {unit}
            </Fig>
          </View>
          <Rule />
        </View>
      ))}

      <Note>Placeholders until phase 8. Bests will come from logged sets, not from the watch.</Note>
    </FitScreen>
  );
}
