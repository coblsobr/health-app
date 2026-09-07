import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/* ── text ─────────────────────────────────────────── */

/** Shared props for the text helpers — style plus the Text props we actually use. */
type TextProps = { children: React.ReactNode; style?: TextStyle; numberOfLines?: number };

export function H3({ children, style, numberOfLines }: TextProps) {
  const { c, fonts } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.display, fontSize: 15, color: c.ink, letterSpacing: -0.2 }, style]}>
      {children}
    </Text>
  );
}

/** Outfit, tight tracking — for any figure the eye should land on. */
export function Num({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { c, fonts } = useTheme();
  return <Text style={[{ fontFamily: fonts.displayBold, fontSize: 16, color: c.ink, letterSpacing: -0.5 }, style]}>{children}</Text>;
}

export function Sm({ children, style, numberOfLines }: TextProps) {
  const { c, fonts } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.body, fontSize: 11, color: c.inkSoft, lineHeight: 16 }, style]}>
      {children}
    </Text>
  );
}

export function Xs({ children, style, numberOfLines }: TextProps) {
  const { c, fonts } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.body, fontSize: 9.5, color: c.inkFaint, lineHeight: 14 }, style]}>
      {children}
    </Text>
  );
}

/** Uppercase card heading. */
export function Ch({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { c, fonts } = useTheme();
  return (
    <View style={[s.row, { marginBottom: 9 }]}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 10, color: c.inkFaint, letterSpacing: 0.9, textTransform: 'uppercase' }}>
        {children}
      </Text>
      {right}
    </View>
  );
}

/* ── containers ───────────────────────────────────── */

export function Card({ children, style }: { children?: React.ReactNode; style?: ViewStyle }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderColor: c.line,
          borderWidth: 1,
          borderRadius: 17,
          padding: 12,
          marginBottom: 10,
          shadowColor: c.shadow,
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}

export function Divider({ style }: { style?: ViewStyle }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.line, marginVertical: 9 }, style]} />;
}

/** Label on the left, value on the right. */
export function KV({ k, v, sub }: { k: string; v: string; sub?: boolean }) {
  const { c, fonts } = useTheme();
  return (
    <View style={[s.row, { paddingVertical: 5 }]}>
      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: sub ? c.inkSoft : c.ink }}>{k}</Text>
      <Text style={{ fontFamily: sub ? fonts.medium : fonts.semi, fontSize: 11, color: sub ? c.inkSoft : c.ink }}>{v}</Text>
    </View>
  );
}

/* ── controls ─────────────────────────────────────── */

export function Chip({ label, on, tone = 'nut' }: { label: string; on?: boolean; tone?: 'nut' | 'fit' }) {
  const { c, fonts } = useTheme();
  const accent = tone === 'fit' ? c.fit : c.nut;
  return (
    <View
      style={{
        backgroundColor: on ? accent : c.cardAlt,
        borderColor: on ? accent : c.line,
        borderWidth: 1,
        borderRadius: 30,
        paddingVertical: 5,
        paddingHorizontal: 11,
      }}
    >
      <Text style={{ fontFamily: fonts.semi, fontSize: 10, color: on ? '#fff' : c.inkSoft }}>{label}</Text>
    </View>
  );
}

export type TagTone = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export function Tag({ label, tone }: { label: string; tone: TagTone }) {
  const { c, fonts } = useTheme();
  const [bg, fg] = { A: c.tagA, B: c.tagB, C: c.tagC, D: c.tagD, E: c.tagE, F: c.tagF }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 20, paddingVertical: 3, paddingHorizontal: 7 }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 8.5, color: fg, letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

export function Btn({
  label,
  tone = 'nut',
  ghost,
  onPress,
  style,
}: {
  label: string;
  tone?: 'nut' | 'fit' | 'hlth';
  ghost?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const { c, fonts } = useTheme();
  const accent = { nut: c.nut, fit: c.fit, hlth: c.hlth }[tone];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: ghost ? 'transparent' : accent,
          borderColor: ghost ? c.line : accent,
          borderWidth: ghost ? 1.4 : 0,
          borderRadius: 14,
          paddingVertical: 12,
          alignItems: 'center',
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: 12.5, color: ghost ? c.inkSoft : '#fff' }}>{label}</Text>
    </Pressable>
  );
}

export function Toggle({ on, tone = 'nut' }: { on?: boolean; tone?: 'nut' | 'fit' | 'hlth' }) {
  const { c } = useTheme();
  const accent = { nut: c.nut, fit: c.fit, hlth: c.hlth }[tone];
  return (
    <View style={{ width: 34, height: 19, borderRadius: 20, backgroundColor: on ? accent : c.track, justifyContent: 'center' }}>
      <View
        style={{
          width: 15,
          height: 15,
          borderRadius: 8,
          backgroundColor: '#fff',
          marginLeft: on ? 17 : 2,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 2,
          elevation: 2,
        }}
      />
    </View>
  );
}

export function Prog({ pct, tone = 'nut', thin }: { pct: number; tone?: 'nut' | 'fit' | 'gold' | 'info'; thin?: boolean }) {
  const { c } = useTheme();
  const accent = { nut: c.nut, fit: c.fit, gold: c.gold, info: c.info }[tone];
  return (
    <View style={{ height: thin ? 5 : 7, backgroundColor: c.track, borderRadius: 10, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', backgroundColor: accent, borderRadius: 10 }} />
    </View>
  );
}

export function Tile({ value, unit, label }: { value: string; unit?: string; label: string }) {
  const { c, fonts } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.card,
        borderColor: c.line,
        borderWidth: 1,
        borderRadius: 15,
        padding: 9,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: c.ink, letterSpacing: -0.5 }}>
        {value}
        {unit ? <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: c.inkFaint }}>{unit}</Text> : null}
      </Text>
      <Text style={{ fontFamily: fonts.semi, fontSize: 8.6, color: c.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Text>
    </View>
  );
}

export function Seg({ options, active }: { options: string[]; active: number }) {
  const { c, fonts } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: 11, padding: 2.5, gap: 2 }}>
      {options.map((o, i) => (
        <View
          key={o}
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: 5,
            borderRadius: 9,
            backgroundColor: i === active ? c.card : 'transparent',
          }}
        >
          <Text style={{ fontFamily: fonts.semi, fontSize: 10, color: i === active ? c.ink : c.inkSoft }}>{o}</Text>
        </View>
      ))}
    </View>
  );
}

export function Stepper({ value }: { value: string | number }) {
  const { c, fonts } = useTheme();
  const box = { width: 22, height: 22, borderRadius: 8, backgroundColor: c.cardAlt, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <View style={box}><Text style={{ fontFamily: fonts.semi, fontSize: 14, color: c.inkSoft }}>−</Text></View>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 12, color: c.ink, minWidth: 26, textAlign: 'center' }}>{value}</Text>
      <View style={box}><Text style={{ fontFamily: fonts.semi, fontSize: 14, color: c.inkSoft }}>+</Text></View>
    </View>
  );
}

/** The amber/red info strip used all over the mockup. */
export function Toast({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  const { c, fonts } = useTheme();
  return (
    <View
      style={{
        backgroundColor: warn ? c.dangerSoft : c.goldSoft,
        borderColor: warn ? c.danger : c.gold,
        borderWidth: 1,
        borderRadius: 13,
        padding: 10,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: c.inkSoft, lineHeight: 16 }}>{children}</Text>
    </View>
  );
}

export function B({ children }: { children: React.ReactNode }) {
  const { c, fonts } = useTheme();
  return <Text style={{ fontFamily: fonts.bold, color: c.ink }}>{children}</Text>;
}

/** Placeholder for a recipe photo until real images exist. */
export function Photo({ g, height = 96, children }: { g: [string, string]; height?: number; children?: React.ReactNode }) {
  return (
    <View style={{ height, backgroundColor: g[1], justifyContent: 'flex-end', padding: 9 }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.6, backgroundColor: g[0], opacity: 0.55 }} />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

/* ── editorial primitives ───────────────────────────────────
   Content sits on the page and is separated by rules, rather than every
   element living in its own bordered, shadowed card. Cards are for things
   that are genuinely objects; most of a screen is not.
   ─────────────────────────────────────────────────────────── */

/** A hairline. The main structural device in place of card borders. */
export function Rule({ style }: { style?: ViewStyle }) {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }, style]} />;
}

/** A quiet section heading in the serif — sentence case, not tracked caps. */
export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { c, fonts } = useTheme();
  return (
    <View style={[s.row, { marginBottom: 6 }]}>
      <Text style={{ fontFamily: fonts.display, fontSize: 17, color: c.ink, letterSpacing: -0.2 }}>{children}</Text>
      {right}
    </View>
  );
}

/** The one number a screen is about. */
export function Hero({
  value, caption, tone,
}: { value: string; caption: string; tone?: string }) {
  const { c, fonts } = useTheme();
  return (
    <View>
      <Text style={{ fontFamily: fonts.display, fontSize: 46, lineHeight: 52, color: tone ?? c.ink, letterSpacing: -1.5 }}>
        {value}
      </Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.inkSoft, marginTop: -2 }}>{caption}</Text>
    </View>
  );
}

/** A 2px progress rule — a line, not a chunky pill. */
export function Meter({ pct, tone }: { pct: number; tone?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ height: 2, backgroundColor: c.track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', backgroundColor: tone ?? c.nut }} />
    </View>
  );
}

/** A row of text with a figure on the right — the workhorse of a list. */
export function LineItem({
  title, meta, value, dim, onPress, right,
}: {
  title: string; meta?: string; value?: string; dim?: boolean;
  onPress?: () => void; right?: React.ReactNode;
}) {
  const { c, fonts } = useTheme();
  const body = (
    <View style={[s.row, { paddingVertical: 11, alignItems: 'flex-start' }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.body, fontSize: 14, color: dim ? c.inkFaint : c.ink }}
        >
          {title}
        </Text>
        {meta ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.inkFaint, marginTop: 2 }}>{meta}</Text>
        ) : null}
      </View>
      {value ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.inkSoft, marginTop: 1 }}>{value}</Text>
      ) : null}
      {right}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

/** A restrained text action. Most screens do not need a filled button. */
export function TextAction({ label, onPress, tone }: { label: string; onPress?: () => void; tone?: string }) {
  const { c, fonts } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 12 }}>
      <Text style={{ fontFamily: fonts.semi, fontSize: 13.5, color: tone ?? c.nut }}>{label}</Text>
    </Pressable>
  );
}

/* ── cookbook devices ───────────────────────────────────────
   Printed cookbooks lean on a few consistent typographic moves: a tracked
   small-caps line above a title, a heavy/hairline rule pair beneath it, an
   italic caption, and the occasional handwritten margin note. Used sparingly
   these read as "set by someone"; used everywhere they read as noise.
   ─────────────────────────────────────────────────────────── */

/** Tracked small caps, sitting above a title. One per screen, not per section. */
export function Eyebrow({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' }) {
  const { c, fonts } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.semi,
        fontSize: 10,
        letterSpacing: 2.2,
        textTransform: 'uppercase',
        color: c.inkFaint,
        textAlign: align,
      }}
    >
      {children}
    </Text>
  );
}

/** The heavy-over-hairline rule pair used under chapter headings in print. */
export function DoubleRule({ style }: { style?: ViewStyle }) {
  const { c } = useTheme();
  return (
    <View style={style}>
      <View style={{ height: 1.5, backgroundColor: c.ink, opacity: 0.75 }} />
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.ink, opacity: 0.35, marginTop: 2 }} />
    </View>
  );
}

/** An italic caption — the line that sits under a recipe title in a book. */
export function Caption({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { c, fonts } = useTheme();
  return (
    <Text style={[{ fontFamily: fonts.displayItalic, fontSize: 15, color: c.inkSoft }, style]}>{children}</Text>
  );
}

/** A handwritten margin note. Deliberately rare. */
export function ScriptNote({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { c, fonts } = useTheme();
  return (
    <Text style={[{ fontFamily: fonts.script, fontSize: 19, color: c.inkSoft, lineHeight: 22 }, style]}>
      {children}
    </Text>
  );
}

/** A centred ornament between sections, as a book uses to break a chapter. */
export function Ornament() {
  const { c, fonts } = useTheme();
  return (
    <Text style={{ fontFamily: fonts.display, fontSize: 13, color: c.inkFaint, textAlign: 'center', marginVertical: 18 }}>
      ❧
    </Text>
  );
}
