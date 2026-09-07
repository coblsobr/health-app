import { View } from 'react-native';
import { FitScreen } from '../../components/fitChrome';
import { Head, Entry, Line, Note } from '../../components/fit';

/** Grouped by day: the date is a column head, not a label inside a card. */
const DAYS: { date: string; total: string; rows: { time: string; name: string; meta: string; cal: string }[] }[] = [
  {
    date: 'Sun 02 Aug',
    total: '482',
    rows: [{ time: '07:04', name: 'Morning run', meta: '4.28 mi · 38:12 · 8:56 pace', cal: '482' }],
  },
  {
    date: 'Sat 01 Aug',
    total: '478',
    rows: [{ time: '10:22', name: 'Legs — squat focus', meta: '55 min · 5 exercises · gym', cal: '478' }],
  },
  {
    date: 'Fri 31 Jul',
    total: '571',
    rows: [
      { time: '18:10', name: 'Evening ride', meta: '11.2 mi · 42:08 · outdoors', cal: '396' },
      { time: '21:15', name: 'Mobility', meta: '18 min · home', cal: '175' },
    ],
  },
  {
    date: 'Thu 30 Jul',
    total: '401',
    rows: [{ time: '06:20', name: 'Pull — back & biceps', meta: '50 min · 6 exercises · gym', cal: '401' }],
  },
];

export default function History() {
  return (
    <FitScreen eyebrow="Training log" title="Past 30 days" right="22 sessions">
      <Head right="4,880 cal">Totals</Head>
      <Line label="Sessions" value="22" sub="last 30 days" />
      <Line label="Time" value="16:42" unit="hr" sub="last 30 days" />
      <Line label="Streak" value="6" unit="days" sub="current" />

      {DAYS.map((d) => (
        <View key={d.date}>
          <Head right={d.total + ' cal'}>{d.date}</Head>
          {d.rows.map((r) => (
            <Entry key={r.time} time={r.time} name={r.name} meta={r.meta} value={r.cal} />
          ))}
        </View>
      ))}

      <Note>Tapping a session will open its map and heart-rate detail once phase 8 lands.</Note>
    </FitScreen>
  );
}
