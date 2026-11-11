import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../theme/theme';
import { formatCompactCurrency } from '../utils/format';

export const DONUT_COLORS = [
  '#067F5B',
  '#142C4B',
  '#10B981',
  '#3B82F6',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
];

export const CashflowBarChart = ({ data = [] }) => {
  if (!data.length) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>Belum ada data arus kas.</Text>
      </View>
    );
  }

  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [Number(d.income || 0), Number(d.expense || 0)])
  );
  const width = 310;
  const height = 160;
  const plotHeight = 115;
  const topPad = 14;
  const groupW = width / data.length;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((step) => {
          const y = topPad + plotHeight * (1 - step);
          return (
            <Line
              key={step}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke="#E5EAE7"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          );
        })}

        {data.map((item, idx) => {
          const incH = (Number(item.income || 0) / maxVal) * plotHeight;
          const expH = (Number(item.expense || 0) / maxVal) * plotHeight;
          const centerX = idx * groupW + groupW / 2;
          const barW = Math.min(14, groupW * 0.28);

          return (
            <G key={`${item.label}-${idx}`}>
              <Rect
                x={centerX - barW - 2}
                y={topPad + (plotHeight - incH)}
                width={barW}
                height={Math.max(incH, item.income > 0 ? 3 : 0)}
                rx={3}
                fill={COLORS.emerald}
              />
              <Rect
                x={centerX + 2}
                y={topPad + (plotHeight - expH)}
                width={barW}
                height={Math.max(expH, item.expense > 0 ? 3 : 0)}
                rx={3}
                fill={COLORS.navy}
              />
              <SvgText
                x={centerX}
                y={topPad + plotHeight + 18}
                fontSize={10}
                fontWeight="600"
                fill={COLORS.grayText}
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: COLORS.emerald }]} />
          <Text style={styles.legendLabel}>Pemasukan</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: COLORS.navy }]} />
          <Text style={styles.legendLabel}>Pengeluaran</Text>
        </View>
        <Text style={styles.maxCaption}>Maks: {formatCompactCurrency(maxVal)}</Text>
      </View>
    </View>
  );
};

export const DonutChart = ({
  segments = [],
  centerTitle = '',
  centerValue = '',
  size = 168,
  strokeWidth = 24,
}) => {
  const total = segments.reduce((acc, s) => acc + Math.max(0, Number(s.value || 0)), 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulative = 0;

  return (
    <View style={styles.donutWrap}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${center}, ${center}`}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#EAEFED"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {total > 0 &&
              segments.map((seg, idx) => {
                const val = Math.max(0, Number(seg.value || 0));
                if (val <= 0) return null;
                const fraction = val / total;
                const arcLen = circumference * fraction;
                const dashOffset = -circumference * cumulative;
                cumulative += fraction;
                return (
                  <Circle
                    key={`${seg.label}-${idx}`}
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={seg.color || DONUT_COLORS[idx % DONUT_COLORS.length]}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${arcLen} ${circumference}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="butt"
                    fill="transparent"
                  />
                );
              })}
          </G>
        </Svg>

        <View style={[StyleSheet.absoluteFillObject, styles.donutCenter]}>
          {!!centerTitle && <Text style={styles.donutTitle}>{centerTitle}</Text>}
          {!!centerValue && (
            <Text style={styles.donutValue} numberOfLines={1} adjustsFontSizeToFit>
              {centerValue}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyChart: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.grayLight,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: COLORS.grayText,
    fontWeight: '600',
  },
  maxCaption: {
    fontSize: 10,
    color: COLORS.grayLight,
  },
  donutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  donutTitle: {
    fontSize: 10,
    color: COLORS.grayText,
    fontWeight: '600',
  },
  donutValue: {
    fontSize: 13,
    color: COLORS.navy,
    fontWeight: '700',
    marginTop: 2,
  },
});
