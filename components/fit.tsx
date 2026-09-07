import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The Fitness design language.
 *
 * Nutrition is a cookbook: photos, warm paper, a serif. Fitness is a training
 * logbook: a black spine, condensed caps, and figures in a monospace so the
 * columns line up the way they do on a printed results sheet.
 *
 * Rules for this world, each one a reaction to what the section looked like
 * before:
 *   - No cards. Rows sit on the page ground, divided by hairlines that run the
 *     full width. Floating rounded slabs are what made it read as generated.
 *   - No centred hero figure. The number a screen exists to show goes at the
 *     end of a line, in a column with the others.
 *   - No standalone chart panel. A magnitude is drawn as a bar inside the row
 *     it belongs to, so the chart and the table are one object.
 *   - Tight vertical rhythm. Rows are ~30px, not ~56px with 16px of air.
 */

export function useFit() {
  const { c, fonts } = useTheme();
  return { c, fonts };
}

const HAIR = StyleSheet.hairlineWidth;

/** Cancels the page padding so a rule reaches both edges. */
const BLEED = -14;

/** A figure. Monospaced and tabular so digits sit in a true column. */
export function Fig({
  children,
  size = 13,
  tone,
  weight = 'med',
  style,
}: {
  children: React.ReactNode;
  size?: number;
  tone?: string;
  weight?: 'reg' | 'med' | 'semi';
  style?: TextStyle;
}) {
  const { c, fonts } = useFit();
  const family =
    weight === 'semi' ? fonts.fitMonoSemi : weight === 'med' ? fonts.fitMonoMed : fonts.fitMono;
  return (
    <Text
      style={[
        { fontFamily: family, fontSize: size, color: tone ?? c.ink, fontVariant: ['tabular-nums'] },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Condensed caps. Labels, mastheads, column heads — everything structural. */
export function Caps({
  children,
  size = 12,
  tone,
  track = 0.6,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: number;
  tone?: string;
  track?: number;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const { c, fonts } = useFit();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontFamily: fonts.fitDisplay, fontSize: size, color: tone ?? c.ink, letterSpacing: track },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** A full-bleed hairline. */
export function Rule({ strong = false, style }: { strong?: boolean; style?: ViewStyle }) {
  const { c } = useFit();
  return (
    <View
      style={[
        {
          height: strong ? 1.5 : HAIR,
          backgroundColor: strong ? c.ink : c.line,
          marginHorizontal: BLEED,
        },
        style,
      ]}
    />
  );
}

/**
 * A column head: tiny caps over a heavy rule, the way a ledger page starts.
 * `right` sits over the figures — a second heading, or a Switcher.
 */
export function Head({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { c } = useFit();
  return (
    <View style={{ marginTop: 20 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingBottom: 4,
        }}
      >
        <Caps size={13} tone={c.inkSoft} track={1.4}>
          {children}
        </Caps>
        {typeof right === 'string' ? (
          <Caps size={11} tone={c.inkFaint} track={1.2}>
            {right}
          </Caps>
        ) : (
          right
        )}
      </View>
      <Rule strong />
    </View>
  );
}

/**
 * One ledger line: label, an optional magnitude bar, and a right-aligned
 * figure. `pct` (0-1) fills the bar; leave it out and the row is plain text.
 */
export function Line({
  label,
  value,
  unit,
  pct,
  tone,
  sub,
  onPress,
}: {
  label: string;
  value: string;
  unit?: string;
  pct?: number;
  tone?: string;
  sub?: string;
  onPress?: () => void;
}) {
  const { c } = useFit();
  const accent = tone ?? c.fit;

  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: sub ? 38 : 30, gap: 10 }}>
        <View style={{ width: 78 }}>
          <Caps size={12.5} tone={c.inkSoft} track={0.9}>
            {label}
          </Caps>
          {sub ? <Fig size={8.5} tone={c.inkFaint}>{sub}</Fig> : null}
        </View>

        {pct != null ? (
          <View style={{ flex: 1, height: 7, backgroundColor: c.track }}>
            <View
              style={{
                width: `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`,
                height: 7,
                backgroundColor: accent,
              }}
            />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            minWidth: 76,
            justifyContent: 'flex-end',
          }}
        >
          <Fig size={13.5} weight="semi">
            {value}
          </Fig>
          {unit ? (
            <Fig size={9} tone={c.inkFaint} style={{ marginLeft: 3 }}>
              {unit}
            </Fig>
          ) : null}
        </View>
      </View>
      <Rule />
    </>
  );

  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : <View>{body}</View>;
}

/**
 * A logged session. Time in the left gutter, the session in the middle, the
 * figure in the same right-hand column every other number uses.
 */
export function Entry({
  time,
  name,
  meta,
  value,
  unit = 'cal',
  onPress,
}: {
  time: string;
  name: string;
  meta: string;
  value: string;
  unit?: string;
  onPress?: () => void;
}) {
  const { c } = useFit();
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 10 }}>
        <Fig size={11} tone={c.fit} weight="semi" style={{ width: 44, marginTop: 2 }}>
          {time}
        </Fig>
        <View style={{ flex: 1 }}>
          <Caps size={15} track={0.5} numberOfLines={1}>
            {name}
          </Caps>
          <Fig size={9.5} tone={c.inkFaint} style={{ marginTop: 1 }}>
            {meta}
          </Fig>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            minWidth: 76,
            justifyContent: 'flex-end',
          }}
        >
          <Fig size={13.5} weight="semi">
            {value}
          </Fig>
          <Fig size={9} tone={c.inkFaint} style={{ marginLeft: 3 }}>
            {unit}
          </Fig>
        </View>
      </View>
      <Rule />
    </>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : <View>{body}</View>;
}

/**
 * An inline switcher, meant to sit on the right of a column head. A pill row
 * of options across the top of a screen is the single most recognisable
 * generated-UI shape there is, so this world does not have one.
 */
export function Switcher({
  options,
  active,
  onChange,
}: {
  options: string[];
  active: number;
  onChange?: (i: number) => void;
}) {
  const { c } = useFit();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
      {options.map((o, i) => (
        <Pressable key={o} onPress={() => onChange?.(i)} hitSlop={8}>
          <Caps
            size={12}
            track={1}
            tone={i === active ? c.fit : c.inkFaint}
            style={
              i === active
                ? { borderBottomWidth: 1.5, borderBottomColor: c.fit, paddingBottom: 1 }
                : undefined
            }
          >
            {o}
          </Caps>
        </Pressable>
      ))}
    </View>
  );
}

/** A sparkline that lives inside a row, not in a panel of its own. */
export function Spark({
  values,
  tone,
  height = 22,
}: {
  values: number[];
  tone?: string;
  height?: number;
}) {
  const { c } = useFit();
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const w = 100;
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * w;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return x.toFixed(1) + ',' + y.toFixed(1);
    })
    .join(' ');
  return (
    <Svg width="100%" height={height} viewBox={'0 0 ' + w + ' ' + height} preserveAspectRatio="none">
      <Polyline
        points={pts}
        fill="none"
        stroke={tone ?? c.fit}
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
    </Svg>
  );
}

/** A footnote. Left-aligned and quiet — never a centred italic apology. */
export function Note({ children }: { children: React.ReactNode }) {
  const { c, fonts } = useFit();
  return (
    <Text
      style={{
        fontFamily: fonts.fitMono,
        fontSize: 9.5,
        lineHeight: 15,
        color: c.inkFaint,
        marginTop: 18,
      }}
    >
      {children}
    </Text>
  );
}

/** The one button shape this world has: a hard-edged bar, full width. */
export function FitBtn({
  label,
  onPress,
  ghost = false,
}: {
  label: string;
  onPress?: () => void;
  ghost?: boolean;
}) {
  const { c } = useFit();
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginTop: 20,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: ghost ? 'transparent' : c.fit,
        borderWidth: ghost ? 1 : 0,
        borderColor: c.line,
      }}
    >
      <Caps size={15} track={1.6} tone={ghost ? c.inkSoft : '#fff'}>
        {label}
      </Caps>
    </Pressable>
  );
}
