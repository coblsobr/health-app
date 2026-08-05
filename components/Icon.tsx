import React from 'react';
import Svg, { Path, Circle, Rect, Polyline } from 'react-native-svg';

export type IconName =
  | 'diary' | 'library' | 'plus' | 'calendar' | 'cart'
  | 'clock' | 'target' | 'chart' | 'dumbbell' | 'shield'
  | 'settings' | 'search' | 'chevron' | 'heart' | 'person'
  | 'basket' | 'camera' | 'link' | 'globe' | 'pencil';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 20, color = '#000', strokeWidth = 2 }: Props) {
  const s = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'diary' && <Path {...s} d="M4 6h16M4 12h16M4 18h10" />}
      {name === 'library' && (
        <>
          <Rect {...s} x={4} y={4} width={16} height={16} rx={2} />
          <Path {...s} d="M9 4v16" />
        </>
      )}
      {name === 'plus' && <Path {...s} d="M12 5v14M5 12h14" />}
      {name === 'calendar' && (
        <>
          <Rect {...s} x={3} y={4} width={18} height={17} rx={2} />
          <Path {...s} d="M3 10h18M8 2v4M16 2v4" />
        </>
      )}
      {name === 'cart' && (
        <>
          <Path {...s} d="M6 6h15l-1.5 9h-12z" />
          <Circle {...s} cx={9} cy={20} r={1.4} />
          <Circle {...s} cx={18} cy={20} r={1.4} />
          <Path {...s} d="M6 6 5 2H2" />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle {...s} cx={12} cy={12} r={9} />
          <Path {...s} d="M12 7v5l3 3" />
        </>
      )}
      {name === 'target' && (
        <>
          <Circle {...s} cx={12} cy={12} r={9} />
          <Circle {...s} cx={12} cy={12} r={4} />
        </>
      )}
      {name === 'chart' && <Polyline {...s} points="3,17 8,11 12,15 17,7 21,12" />}
      {name === 'dumbbell' && <Path {...s} d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" />}
      {name === 'shield' && <Path {...s} d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11Z" />}
      {name === 'settings' && (
        <>
          <Circle {...s} cx={12} cy={12} r={3} />
          <Path {...s} d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
        </>
      )}
      {name === 'search' && (
        <>
          <Circle {...s} cx={11} cy={11} r={7} />
          <Path {...s} d="m20 20-3.5-3.5" />
        </>
      )}
      {name === 'chevron' && <Path {...s} d="m9 6 6 6-6 6" />}
      {name === 'heart' && <Path {...s} d="M12 20s-7-4.6-7-9.4A4 4 0 0 1 12 8a4 4 0 0 1 7 2.6c0 4.8-7 9.4-7 9.4Z" />}
      {name === 'person' && (
        <>
          <Circle {...s} cx={12} cy={8} r={4} />
          <Path {...s} d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
        </>
      )}
      {name === 'basket' && <Path {...s} d="M5 9h14l-1.5 11h-11zM8 9l2-5M16 9l-2-5" />}
      {name === 'camera' && (
        <>
          <Path {...s} d="M4 8h3l1.5-2h7L17 8h3v12H4z" />
          <Circle {...s} cx={12} cy={13} r={3.5} />
        </>
      )}
      {name === 'link' && <Path {...s} d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />}
      {name === 'globe' && (
        <>
          <Circle {...s} cx={12} cy={12} r={9} />
          <Path {...s} d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18" />
        </>
      )}
      {name === 'pencil' && <Path {...s} d="M4 20h4L20 8l-4-4L4 16v4Z" />}
    </Svg>
  );
}
