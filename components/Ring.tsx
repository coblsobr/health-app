import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

/** Half-circle gauge used on both Today screens. `pct` is 0–1. */
export function Ring({ value, label, pct, accent }: { value: string; label: string; pct: number; accent: string }) {
  const { c, fonts } = useTheme();
  const r = 62;
  const half = Math.PI * r; // arc length of a half circle
  const shown = Math.min(1, Math.max(0, pct));

  return (
    <View style={{ height: 122, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={200} height={122} viewBox="0 0 200 122">
        <Circle
          cx={100} cy={96} r={r}
          stroke={c.track} strokeWidth={13} fill="none" strokeLinecap="round"
          strokeDasharray={`${half} ${half * 2}`}
          transform="rotate(180 100 96)"
        />
        <Circle
          cx={100} cy={96} r={r}
          stroke={accent} strokeWidth={13} fill="none" strokeLinecap="round"
          strokeDasharray={`${half * shown} ${half * 2}`}
          transform="rotate(180 100 96)"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', top: 46 }}>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 31, color: c.ink, letterSpacing: -1 }}>{value}</Text>
        <Text style={{ fontFamily: fonts.semi, fontSize: 9.5, color: c.inkFaint, letterSpacing: 1.2 }}>{label}</Text>
      </View>
    </View>
  );
}
