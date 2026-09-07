import { View, Pressable } from 'react-native';
import { FitScreen } from '../../components/fitChrome';
import { Label, MetaLine, Fig, T, Rule, Aside, FitBtn, Note } from '../../components/fit';
import { useTheme } from '../../theme/ThemeProvider';

const WEEK: { day: string; date: string; name: string; meta: string; cal: string }[] = [
  { day: 'Mon', date: '4', name: 'Push — chest & triceps', meta: '50 min · gym', cal: '420' },
  { day: 'Tue', date: '5', name: 'Rowing intervals', meta: '25 min · gym', cal: '280' },
  { day: 'Wed', date: '6', name: 'Rest', meta: '', cal: '' },
  { day: 'Thu', date: '7', name: 'Pull — back & biceps', meta: '50 min · gym', cal: '400' },
  { day: 'Fri', date: '8', name: 'Legs — squat focus', meta: '55 min · gym', cal: '480' },
  { day: 'Sat', date: '9', name: 'Long walk', meta: '60 min · outdoors', cal: '300' },
  { day: 'Sun', date: '10', name: 'Rest', meta: '', cal: '' },
];

export default function FitnessPlan() {
  const { c } = useTheme();

  return (
    <FitScreen eyebrow="Training · fat loss" title="Week 32" right="4 – 10 Aug">
      <MetaLine>5 sessions · 4h 00m planned · ~1,880 cal</MetaLine>

      <Label>Schedule</Label>
      {WEEK.map((d) => {
        const rest = !d.cal;
        return (
          <Pressable key={d.day}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 11 }}>
              <View style={{ width: 38 }}>
                <T size={11.5} weight="bold" tone={rest ? c.fitTextFaint : c.fitText}>
                  {d.day}
                </T>
                <Fig size={9} weight="light" tone={c.fitTextFaint}>
                  {d.date}
                </Fig>
              </View>
              <View style={{ flex: 1 }}>
                <T size={14} weight="label" tone={rest ? c.fitTextFaint : c.fitText} numberOfLines={1}>
                  {d.name}
                </T>
                {d.meta ? (
                  <Fig size={9.5} weight="light" tone={c.fitTextFaint} style={{ marginTop: 2 }}>
                    {d.meta}
                  </Fig>
                ) : null}
              </View>
              <Fig size={13} weight="med" tone={rest ? c.fitTextFaint : c.fitText}>
                {d.cal || '—'}
              </Fig>
            </View>
            <Rule />
          </Pressable>
        );
      })}

      <Aside>Built around no running, bench and squat, and the gym four times a week.</Aside>

      <FitBtn label="Rebuild the week" />

      <Note>Rebuilding will use logged sessions and the goal set in your profile.</Note>
    </FitScreen>
  );
}
