import { FitScreen } from '../../components/fitChrome';
import { Statement, Bar, MetaLine, Label, Session, Aside, Note } from '../../components/fit';

const SESSIONS = [
  { time: '06:12', name: 'Push — chest & tri', meta: '48 min · 6 exercises', cal: '412' },
  { time: '19:40', name: 'Evening walk', meta: '32 min · 1.7 mi', cal: '154' },
];

/**
 * Four facts, four different shapes. The previous version had Effort, Sessions,
 * Heart rate and Feeds-nutrition all as labelled tables of near-identical rows,
 * which is why it read as noise: nothing on the screen was louder than
 * anything else. Steps, active minutes and distance are secondary, so they
 * are one line rather than three labelled rows.
 */
export default function FitnessToday() {
  return (
    <FitScreen eyebrow="Training · week 32" title="Mon 3 Aug" right="day 214">
      <Statement lead="Burned" value="566" trail="of 690 cal" />
      <Bar pct={566 / 690} />
      <MetaLine>9,241 steps · 54 min active · 4.1 mi</MetaLine>

      <Label>Sessions</Label>
      {SESSIONS.map((s) => (
        <Session key={s.time} time={s.time} name={s.name} meta={s.meta} value={s.cal} />
      ))}

      <Aside>Training adds 269 cal a day to your food budget this week.</Aside>

      <Note>Placeholder figures until Health Connect is wired up in phase 8.</Note>
    </FitScreen>
  );
}
