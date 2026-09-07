import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { FitScreen } from '../../components/fitChrome';
import { Head, Fig, Caps, Rule, FitBtn, Note } from '../../components/fit';
import { useTheme } from '../../theme/ThemeProvider';

const TYPES = ['Strength', 'Run', 'Ride', 'Walk', 'Mobility', 'Swim', 'Row', 'Other'];

const FIELDS: [string, string][] = [
  ['Duration', '45 min'],
  ['Calories', 'auto-estimate'],
  ['When', 'Today · 06:12'],
  ['Where', 'Gym'],
  ['Notes', '—'],
];

export default function Log() {
  const { c } = useTheme();
  const [type, setType] = useState(0);

  return (
    <FitScreen eyebrow="Training log" title="New entry" right="mon 03 aug">
      {/* A list, not a wrap of pills. Selection is a mark in the right column,
          the way you would tick a line on a paper form. */}
      <Head right="select">Type</Head>
      {TYPES.map((t, i) => {
        const on = i === type;
        return (
          <Pressable key={t} onPress={() => setType(i)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 30, gap: 10 }}>
              <Fig size={9} tone={on ? c.fit : c.inkFaint} style={{ width: 22 }}>
                {String(i + 1).padStart(2, '0')}
              </Fig>
              <Caps size={15} track={0.4} tone={on ? c.ink : c.inkSoft} style={{ flex: 1 }}>
                {t}
              </Caps>
              <View
                style={{
                  width: 11,
                  height: 11,
                  backgroundColor: on ? c.fit : 'transparent',
                  borderWidth: on ? 0 : 1,
                  borderColor: c.line,
                }}
              />
            </View>
            <Rule />
          </Pressable>
        );
      })}

      <Head right="tap to edit">Details</Head>
      {FIELDS.map(([k, v]) => (
        <Pressable key={k}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', height: 30, gap: 10 }}>
            <Caps size={14} track={0.4} tone={c.inkSoft} style={{ width: 84 }}>
              {k}
            </Caps>
            <Fig size={11.5} style={{ flex: 1, textAlign: 'right' }}>
              {v}
            </Fig>
          </View>
          <Rule />
        </Pressable>
      ))}

      <FitBtn label="Save entry" />
      <FitBtn label="Start a timer instead" ghost />

      <Note>
        Manual entry is the backstop. Most sessions will arrive from the watch on their own once
        Health Connect is wired up.
      </Note>
    </FitScreen>
  );
}
