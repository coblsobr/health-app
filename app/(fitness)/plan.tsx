import { View, Pressable } from 'react-native';
import { FitScreen } from '../../components/fitChrome';
import { Head, Line, Fig, Caps, Rule, FitBtn, Note } from '../../components/fit';
import { useTheme } from '../../theme/ThemeProvider';

type Kind = 'strength' | 'cardio' | 'rest';
const WEEK: { day: string; date: string; name: string; meta: string; cal: string; kind: Kind }[] = [
  { day: 'Mon', date: '04', name: 'Push — chest & triceps', meta: '50 min · gym', cal: '420', kind: 'strength' },
  { day: 'Tue', date: '05', name: 'Rowing intervals', meta: '25 min · gym', cal: '280', kind: 'cardio' },
  { day: 'Wed', date: '06', name: 'Rest', meta: 'mobility if you feel like it', cal: '—', kind: 'rest' },
  { day: 'Thu', date: '07', name: 'Pull — back & biceps', meta: '50 min · gym', cal: '400', kind: 'strength' },
  { day: 'Fri', date: '08', name: 'Legs — squat focus', meta: '55 min · gym', cal: '480', kind: 'strength' },
  { day: 'Sat', date: '09', name: 'Long walk', meta: '60 min · outdoors', cal: '300', kind: 'cardio' },
  { day: 'Sun', date: '10', name: 'Rest', meta: '', cal: '—', kind: 'rest' },
];

export default function FitnessPlan() {
  const { c } = useTheme();

  return (
    <FitScreen eyebrow="Training log · built for fat loss" title="Week 32" right="04 – 10 aug">
      <Head right="cal">Schedule</Head>
      {WEEK.map((d) => {
        const rest = d.kind === 'rest';
        return (
          <Pressable key={d.day}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 10 }}>
              <View style={{ width: 44 }}>
                <Caps size={13} track={1} tone={rest ? c.inkFaint : c.fit}>
                  {d.day.toUpperCase()}
                </Caps>
                <Fig size={9} tone={c.inkFaint}>
                  {d.date} aug
                </Fig>
              </View>

              {/* A hairline stripe carries the kind, instead of a coloured pill. */}
              <View
                style={{
                  width: 2,
                  alignSelf: 'stretch',
                  backgroundColor: rest ? 'transparent' : d.kind === 'strength' ? c.fit : c.info,
                }}
              />

              <View style={{ flex: 1 }}>
                <Caps size={15} track={0.5} tone={rest ? c.inkFaint : c.ink} numberOfLines={1}>
                  {d.name}
                </Caps>
                {d.meta ? (
                  <Fig size={9.5} tone={c.inkFaint} style={{ marginTop: 1 }}>
                    {d.meta}
                  </Fig>
                ) : null}
              </View>

              <Fig size={13.5} weight="semi" tone={rest ? c.inkFaint : c.ink} style={{ minWidth: 46, textAlign: 'right' }}>
                {d.cal}
              </Fig>
            </View>
            <Rule />
          </Pressable>
        );
      })}

      <Head right="week">Totals</Head>
      <Line label="Burn" value="1,880" unit="cal" sub="5 sessions" />
      <Line label="Time" value="4:00" unit="hr" sub="planned" />
      <Line label="Food" value="+269" unit="cal / day" tone={c.nut} sub="added to budget" />

      <Head right="from your profile">Built on</Head>
      <Line label="Avoid" value="Running" />
      <Line label="Favour" value="Bench, squat" />
      <Line label="Gym" value="4× / week" />

      <FitBtn label="Rebuild the week" />

      <Note>Placeholders. Rebuilding will use logged sessions and the goal set in your profile.</Note>
    </FitScreen>
  );
}
