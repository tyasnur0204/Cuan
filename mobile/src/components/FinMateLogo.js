import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { COLORS } from '../theme/theme';

const FinMateLogo = ({ size = 40, variant = 'glass' }) => {
  const isSolid = variant === 'solid';
  const isLight = variant === 'light';
  const strokeColor = isLight ? COLORS.navy : '#FFFFFF';

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: isSolid
            ? COLORS.emerald
            : isLight
              ? COLORS.bg
              : 'rgba(255,255,255,0.16)',
          borderColor: isSolid
            ? COLORS.emerald
            : isLight
              ? COLORS.border
              : 'rgba(255,255,255,0.25)',
          borderWidth: isSolid ? 0 : 1,
        },
      ]}
    >
      <Svg
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.68)}
        viewBox="0 0 36 36"
        fill="none"
      >
        <Path
          d="M6.8 13.6L23.2 6.4Q25.3 5.45 26.2 7.5L28.6 13.5"
          fill={strokeColor}
          fillOpacity={0.14}
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Rect
          x="4"
          y="13.5"
          width="28"
          height="17.5"
          rx="4"
          fill={strokeColor}
          fillOpacity={0.12}
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <Path
          d="M32 18.6H24.8A3.65 3.65 0 0 0 24.8 25.9H32"
          fill={strokeColor}
          fillOpacity={0.16}
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="24.8" cy="22.25" r="1.65" fill={strokeColor} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default FinMateLogo;
