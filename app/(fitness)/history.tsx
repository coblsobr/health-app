import { View } from 'react-native';
import { FitScreen } from '../../components/fitChrome';
import { Label, MetaLine, Session, Note } from '../../components/fit';

/** Grouped by day. The date is the label; there is no totals table above it. */
const DAYS: { date: string; rows: { time: string; name: string; meta: string; cal: string }[] }[] = [
  {
    date: 'Sun 2 Aug',
    rows: [{ time: '07:04', name: 'Morning run', meta: '4.28 mi · 8:56 pace', cal: '482' }],
  },
  {
    date: 'Sat 1 Aug',
    rows: [{ time: '10:22', name: 'Legs — squat focus', meta: '55 min · gym', cal: '478' }],
  },
  {
    date: 'Fri 31 Jul',
    rows: [
      { time: '18:10', name: 'Evening ride', meta: '11.2 mi · outdoors', cal: '396' },
      { time: '21:15', name: 'Mobility', meta: '18 min · home', cal: '175' },
    ],
  },
  {
    date: 'Thu 30 Jul',
    rows: [{ time: '06:20', name: 'Pull — back & biceps', meta: '50 min · gym', cal: '401' }],
  },
];

export default function History() {
  return (
    <FitScreen eyebrow="Training" title="Past 30 days">
      <MetaLine>22 sessions · 16h 42m · 4,880 cal</MetaLine>

      {DAYS.map((d) => (
        <View key={d.date}>
          <Label>{d.date}</Label>
          {d.rows.map((r) => (
            <Session key={r.time} time={r.time} name={r.name} meta={r.meta} value={r.cal} />
          ))}
        </View>
      ))}

      <Note>Tapping a session opens its map and heart rate once phase 8 lands.</Note>
    </FitScreen>
  );
}
