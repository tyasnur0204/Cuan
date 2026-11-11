import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { COLORS } from '../theme/theme';

const FinMateLogo = ({ size = 40, variant = 'glass' }) => {
  const isSolid = variant === 'solid';
  return (
    <View
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: isSolid ? COLORS.emerald : 'rgba(255,255,255,0.16)',
          borderColor: isSolid ? COLORS.emerald : 'rgba(255,255,255,0.25)',
          borderWidth: isSolid ? 0 : 1,
        },
      ]}
    >
      <Svg
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        viewBox="0 0 36 36"
        fill="none"
      >
        <Rect
          x="6"
          y="15"
          width="24"
          height="14"
          rx="4"
          fill="#FFFFFF"
          fillOpacity={0.22}
          stroke="#FFFFFF"
          strokeWidth="2"
        />
        <Path
          d="M22 20.5H28.5V23.5H22C21.1716 23.5 20.5 22.8284 20.5 22C20.5 21.1716 21.1716 20.5 22 20.5Z"
          fill="#FFFFFF"
        />
        <Path
          d="M18 15V9"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <Path
          d="M18 11.5C18 8 15 6 11.5 6.5C11.5 10 14 12.5 18 11.5Z"
          fill="#FFFFFF"
        />
        <Path
          d="M18 10.5C18 7 21 5 24.5 5.5C24.5 9 22 11.5 18 10.5Z"
          fill="#FFFFFF"
          fillOpacity={0.85}
        />
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
