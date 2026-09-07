import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { FitScreen } from '../../components/fitChrome';
import { Label, T, Fig, Rule, FitBtn, Note } from '../../components/fit';
import { useTheme } from '../../theme/ThemeProvider';

const TYPES = ['Strength', 'Run', 'Ride', 'Walk', 'Mobility', 'Swim'];

const FIELDS: [string, string][] = [
  ['Duration', '45 min'],
  ['When', 'Today · 06:12'],
  ['Calories', 'auto'],
];

export default function Log() {
  const { c } = useTheme();
  const [type, setType] = useState(0);

  return (
    <FitScreen eyebrow="Training" title="New entry" right="Mon 3 Aug">
      {/* A list, not a wrap of pills. Selection is a mark in the margin, the
          way you would tick a line on a paper form. */}
      <Label>Type</Label>
      {TYPES.map((t, i) => {
        const on = i === type;
        return (
          <Pressable key={t} onPress={() => setType(i)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 34, gap: 11 }}>
              <View
                style={{
                  width: 9,
                  height: 9,
                  backgroundColor: on ? c.fit : 'transparent',
                  borderWidth: on ? 0 : 1,
                  borderColor: c.fitLine,
                }}
              />
              <T size={14} weight={on ? 'bold' : 'body'} tone={on ? c.fitText : c.fitTextSoft}>
                {t}
              </T>
            </View>
            <Rule />
          </Pressable>
        );
      })}

      <Label>Details</Label>
      {FIELDS.map(([k, v]) => (
        <Pressable key={k}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', height: 32, gap: 10 }}>
            <T size={13.5} weight="label" tone={c.fitTextSoft} style={{ flex: 1 }}>
              {k}
            </T>
            <Fig size={12} weight="light">
              {v}
            </Fig>
          </View>
          <Rule />
        </Pressable>
      ))}

      <FitBtn label="Save entry" />

      <Note>Most sessions will arrive from the watch on their own. This is the backstop.</Note>
    </FitScreen>
  );
}
