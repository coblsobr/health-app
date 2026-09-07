import React from 'react';
import { View, Text, Pressable, StyleSheet, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The Fitness design language.
 *
 * Nutrition is a cookbook. Fitness is a training logbook: concrete-grey paper,
 * a charcoal spine, one warm accent, and figures in a monospace.
 *
 * Rules for this world:
 *
 *   - No cards, no centred hero figure, no chart in a panel of its own, no
 *     segmented pill row, no bottom tab bar. Those five shapes are what made
 *     the section read as generated.
 *   - **Every block on a screen must look different from the block above it.**
 *     A run of sections sharing a heading, a rule and a row height is the same
 *     failure as a run of cards: the eye finds no hierarchy and reads all of it
 *     as filler. So — one oversized `<Statement>`, one dense `<MetaLine>`, one
 *     `<Session>` list, one `<Aside>`. Never four tables.
 *   - Say less. A screen carries three or four facts, not twenty. Anything
 *     secondary goes on a MetaLine, not in a labelled row of its own.
 *   - Rules belong to lists. A hairline under every single thing is noise.
 */

export function useFit() {
  const { c, fonts } = useTheme();
  return { c, fonts };
}

const HAIR = StyleSheet.hairlineWidth;

/** Cancels the page padding so a rule or bar reaches both edges. */
const BLEED = -16;

/** A figure. Monospaced and tabular so digits sit in a true column. */
export function Fig({
  children,
  size = 13,
  tone,
  weight = 'reg',
  style,
}: {
  children: React.ReactNode;
  size?: number;
  tone?: string;
  weight?: 'light' | 'reg' | 'med';
  style?: TextStyle;
}) {
  const { c, fonts } = useFit();
  const family =
    weight === 'med' ? fonts.fitMonoMed : weight === 'light' ? fonts.fitMonoLight : fonts.fitMono;
  return (
    <Text
      style={[
        {
          fontFamily: family,
          fontSize: size,
          color: tone ?? c.fitText,
          fontVariant: ['tabular-nums'],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Words. Archivo, in one of four weights. */
export function T({
  children,
  size = 13,
  tone,
  weight = 'body',
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: number;
  tone?: string;
  weight?: 'body' | 'label' | 'bold' | 'heavy';
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const { c, fonts } = useFit();
  const family =
    weight === 'heavy'
      ? fonts.fitDisplayHeavy
      : weight === 'bold'
        ? fonts.fitDisplay
        : weight === 'label'
          ? fonts.fitLabel
          : fonts.fitBody;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ fontFamily: family, fontSize: size, color: tone ?? c.fitText }, style]}
    >
      {children}
    </Text>
  );
}

/** A full-bleed hairline. Used between list rows, nowhere else. */
export function Rule() {
  const { c } = useFit();
  return <View style={{ height: HAIR, backgroundColor: c.fitLine, marginHorizontal: BLEED }} />;
}

/**
 * A quiet section label. Deliberately not a heading with a heavy rule under
 * it: stack four of those and the screen has four equal voices and therefore
 * no hierarchy at all.
 */
export function Label({ children, right }: { children: string; right?: React.ReactNode }) {
  const { c } = useFit();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: 26,
        marginBottom: 7,
      }}
    >
      <T size={9.5} weight="label" tone={c.fitTextFaint} style={{ letterSpacing: 1.6 }}>
        {children.toUpperCase()}
      </T>
      {right}
    </View>
  );
}

/**
 * The one loud thing on a screen: an oversized figure set inside a sentence.
 * A number read as part of a line is not the same shape as a number floating
 * in the middle of a panel, which is the shape being avoided here.
 */
export function Statement({
  lead,
  value,
  trail,
  tone,
}: {
  lead: string;
  value: string;
  trail?: string;
  tone?: string;
}) {
  const { c } = useFit();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 20 }}>
      <T size={14} tone={c.fitTextSoft} style={{ marginRight: 9 }}>
        {lead}
      </T>
      <Fig size={42} weight="med" tone={tone} style={{ letterSpacing: -1.6 }}>
        {value}
      </Fig>
      {trail ? (
        <T size={13} tone={c.fitTextSoft} style={{ marginLeft: 9 }}>
          {trail}
        </T>
      ) : null}
    </View>
  );
}

/** A full-bleed progress rule. Sits under a Statement, never inside a row. */
export function Bar({ pct, tone }: { pct: number; tone?: string }) {
  const { c } = useFit();
  return (
    <View style={{ height: 3, backgroundColor: c.fitTrack, marginHorizontal: BLEED, marginTop: 11 }}>
      <View
        style={{
          width: `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`,
          height: 3,
          backgroundColor: tone ?? c.fit,
        }}
      />
    </View>
  );
}

/**
 * Every secondary number on the screen, on one line. Four facts that each had
 * a labelled row of their own is exactly the spread-out sameness this section
 * had too much of; as one line they cost four words and read in a glance.
 */
export function MetaLine({ children }: { children: React.ReactNode }) {
  const { c } = useFit();
  return (
    <Fig size={11} weight="light" tone={c.fitTextSoft} style={{ marginTop: 13, lineHeight: 17 }}>
      {children}
    </Fig>
  );
}

/** A logged session. Time in the gutter, figure on the right. */
export function Session({
  time,
  name,
  meta,
  value,
  onPress,
}: {
  time: string;
  name: string;
  meta?: string;
  value: string;
  onPress?: () => void;
}) {
  const { c } = useFit();
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 11 }}>
        <Fig size={10.5} tone={c.fitTextFaint} style={{ width: 38 }}>
          {time}
        </Fig>
        <View style={{ flex: 1 }}>
          <T size={14} weight="label" numberOfLines={1}>
            {name}
          </T>
          {meta ? (
            <Fig size={9.5} weight="light" tone={c.fitTextFaint} style={{ marginTop: 2 }}>
              {meta}
            </Fig>
          ) : null}
        </View>
        <Fig size={13} weight="med">
          {value}
        </Fig>
      </View>
      <Rule />
    </>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : <View>{body}</View>;
}

/**
 * A short sentence marked by a bar in the margin. This is how the section says
 * something rather than tabulating it — the one place the two worlds talk to
 * each other should read as a remark, not as another data row.
 */
export function Aside({ children }: { children: React.ReactNode }) {
  const { c } = useFit();
  return (
    <View style={{ flexDirection: 'row', marginTop: 26, gap: 11 }}>
      <View style={{ width: 2, backgroundColor: c.fit }} />
      <T size={13.5} weight="label" style={{ flex: 1, lineHeight: 19 }}>
        {children}
      </T>
    </View>
  );
}

/** Inline switcher. Sits on a Label's right, never as a pill row of its own. */
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
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 13 }}>
      {options.map((o, i) => (
        <Pressable key={o} onPress={() => onChange?.(i)} hitSlop={8}>
          <T
            size={11}
            weight={i === active ? 'bold' : 'body'}
            tone={i === active ? c.fit : c.fitTextFaint}
          >
            {o}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

/** A two-column list row. For short lists — three or four, not eight. */
export function Row({
  label,
  value,
  unit,
  onPress,
}: {
  label: string;
  value: string;
  unit?: string;
  onPress?: () => void;
}) {
  const { c } = useFit();
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', height: 32, gap: 10 }}>
        <T size={13.5} weight="label" style={{ flex: 1 }}>
          {label}
        </T>
        <Fig size={13} weight="med">
          {value}
        </Fig>
        {unit ? (
          <Fig size={9.5} weight="light" tone={c.fitTextFaint} style={{ width: 42 }}>
            {unit}
          </Fig>
        ) : null}
      </View>
      <Rule />
    </>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : <View>{body}</View>;
}

/** A footnote. Left-aligned and quiet. */
export function Note({ children }: { children: React.ReactNode }) {
  const { c } = useFit();
  return (
    <T size={11} tone={c.fitTextFaint} style={{ marginTop: 24, lineHeight: 17 }}>
      {children}
    </T>
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
        marginTop: 24,
        paddingVertical: 13,
        alignItems: 'center',
        backgroundColor: ghost ? 'transparent' : c.fit,
        borderWidth: ghost ? HAIR : 0,
        borderColor: c.fitLine,
      }}
    >
      <T
        size={13}
        weight="bold"
        tone={ghost ? c.fitTextSoft : '#fff'}
        style={{ letterSpacing: 0.3 }}
      >
        {label}
      </T>
    </Pressable>
  );
}
