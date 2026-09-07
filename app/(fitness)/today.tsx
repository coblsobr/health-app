import { View } from 'react-native';
import { FitScreen } from '../../components/fitChrome';
import { Head, Line, Entry, Fig, Caps, Spark, Note, Rule } from '../../components/fit';
import { useTheme } from '../../theme/ThemeProvider';

const SESSIONS = [
  { time: '06:12', name: 'Push — chest & tri', meta: '48 min · 6 exercises · gym', cal: '412' },
  { time: '19:40', name: 'Evening walk', meta: '32 min · 1.7 mi · outdoors', cal: '154' },
];

const HR = [62, 64, 88, 132, 148, 141, 156, 164, 149, 121, 96, 78, 71, 66, 63];

export default function FitnessToday() {
  const { c } = useTheme();

  return (
    <FitScreen eyebrow="Training log · week 32" title="Mon 03 Aug" right="day 214">
      <Head right="of target">Effort</Head>
      <Line label="Burn" value="566" unit="/ 690 cal" pct={566 / 690} />
      <Line label="Steps" value="9,241" unit="/ 10,000" pct={9241 / 10000} />
      <Line label="Active" value="54" unit="/ 60 min" pct={54 / 60} />
      <Line label="Distance" value="4.1" unit="mi" pct={4.1 / 5} />
      <Line label="Standing" value="11" unit="/ 12 hr" pct={11 / 12} />

      <Head right="cal">Sessions</Head>
      {SESSIONS.map((s) => (
        <Entry key={s.time} time={s.time} name={s.name} meta={s.meta} value={s.cal} />
      ))}

      <Head right="bpm">Heart rate</Head>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 40, gap: 10 }}>
        <View style={{ width: 64 }}>
          <Caps size={12.5} tone={c.inkSoft} track={0.9}>
            All day
          </Caps>
          <Fig size={8.5} tone={c.inkFaint}>
            06:00–20:00
          </Fig>
        </View>
        <View style={{ flex: 1 }}>
          <Spark values={HR} tone={c.fit} height={26} />
        </View>
        <View style={{ minWidth: 76, alignItems: 'flex-end' }}>
          <Fig size={13.5} weight="semi">
            164
          </Fig>
          <Fig size={8.5} tone={c.inkFaint}>
            peak
          </Fig>
        </View>
      </View>
      <Rule />
      <Line label="Resting" value="62" unit="bpm" />
      <Line label="Average" value="118" unit="bpm" />

      <Head right="effect">Feeds nutrition</Head>
      <Line label="Budget" value="+269" unit="cal / day" tone={c.nut} sub="this week" />
      <Line label="Protein" value="+18" unit="g / day" tone={c.nut} sub="lift days" />

      <Note>
        Figures are placeholders. Health Connect wiring lands in phase 8 — after that these read from
        the watch and the food budget moves on its own.
      </Note>
    </FitScreen>
  );
}
