import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { spacing, useTheme } from '../theme/theme';

export interface BarDatum {
  key: string;
  label: string;
  value: number | null;
  estimate: boolean;
  /** Full description used for the selected-value readout and screen readers. */
  description: string;
}

/**
 * Accessible bar chart: every bar can be selected to read its exact value, estimates use a lighter
 * fill AND are described in text, and the chart has a summary label for screen readers.
 */
export function BarChart({ data, unit, height = 160, summary }: { data: BarDatum[]; unit: string; height?: number; summary: string }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const max = Math.max(...data.map((d) => d.value ?? 0), 0);
  const gap = data.length > 40 ? 1 : 3;
  const barWidth = data.length > 0 && width > 0 ? Math.max((width - gap * (data.length - 1)) / data.length, 1) : 0;
  const active = data.find((d) => d.key === selected) ?? data.at(-1);

  return (
    <View accessible accessibilityLabel={summary} style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.text, fontWeight: '600' }} accessibilityLiveRegion="polite">
        {active ? active.description : 'Brak danych'}
      </Text>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={height - 1} y2={height - 1} stroke={colors.border} strokeWidth={1} />
            {data.map((d, i) => {
              const h = max > 0 && d.value ? Math.max((d.value / max) * (height - 8), 2) : 0;
              const isActive = d.key === active?.key;
              return (
                <Rect
                  key={d.key}
                  x={i * (barWidth + gap)}
                  y={height - 1 - h}
                  width={barWidth}
                  height={h}
                  rx={Math.min(3, barWidth / 2)}
                  fill={d.estimate ? colors.chartBarEstimate : colors.chartBar}
                  stroke={isActive ? colors.text : 'none'}
                  strokeWidth={isActive ? 1.5 : 0}
                />
              );
            })}
          </Svg>
        ) : null}
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          {data.map((d) => (
            <Pressable
              key={d.key}
              style={{ flex: 1 }}
              onPress={() => setSelected(d.key)}
              accessibilityRole="button"
              accessibilityLabel={d.description}
            />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{data[0]?.label ?? ''}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>maks. {max.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} {unit}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{data.at(-1)?.label ?? ''}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <Legend color={colors.chartBar} label="Na podstawie odczytów" />
        <Legend color={colors.chartBarEstimate} label="Estymacja" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
