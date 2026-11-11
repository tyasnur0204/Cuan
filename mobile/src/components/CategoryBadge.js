import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../theme/theme';

const resolveIcon = (category = '', type = '') => {
  const cat = String(category).toLowerCase();
  if (type === 'Transfer' || cat.includes('transfer')) {
    return { name: 'swap-horizontal', bg: COLORS.blueBg, color: COLORS.blue };
  }
  if (
    cat.includes('makan') ||
    cat.includes('minum') ||
    cat.includes('kopi') ||
    cat.includes('kuliner')
  ) {
    return { name: 'restaurant', bg: '#FFF7ED', color: '#EA580C' };
  }
  if (
    cat.includes('transport') ||
    cat.includes('gojek') ||
    cat.includes('grab') ||
    cat.includes('bensin')
  ) {
    return { name: 'car', bg: '#F0F9FF', color: '#0284C7' };
  }
  if (
    cat.includes('pendidikan') ||
    cat.includes('kuliah') ||
    cat.includes('buku') ||
    cat.includes('kursus')
  ) {
    return { name: 'school', bg: '#EEF2FF', color: '#4F46E5' };
  }
  if (
    cat.includes('hiburan') ||
    cat.includes('film') ||
    cat.includes('game') ||
    cat.includes('nonton')
  ) {
    return { name: 'game-controller', bg: '#F5F3FF', color: '#7C3AED' };
  }
  if (
    cat.includes('invest') ||
    cat.includes('reksa') ||
    cat.includes('sbn') ||
    cat.includes('saham')
  ) {
    return { name: 'trending-up', bg: COLORS.emeraldLight, color: COLORS.emerald };
  }
  if (
    cat.includes('tabung') ||
    cat.includes('saving') ||
    cat.includes('impian') ||
    cat.includes('darurat')
  ) {
    return { name: 'wallet', bg: '#F0FDFA', color: '#0D9488' };
  }
  if (cat.includes('elektronik') || cat.includes('laptop') || cat.includes('hp')) {
    return { name: 'laptop-outline', bg: '#EFF6FF', color: '#2563EB' };
  }
  if (cat.includes('kendaraan') || cat.includes('motor') || cat.includes('mobil')) {
    return { name: 'bicycle-outline', bg: '#F0F9FF', color: '#0284C7' };
  }
  if (cat.includes('liburan') || cat.includes('wisata')) {
    return { name: 'airplane-outline', bg: '#FDF4FF', color: '#A21CAF' };
  }
  if (cat.includes('rumah') || cat.includes('properti')) {
    return { name: 'home-outline', bg: '#ECFDF5', color: '#059669' };
  }
  if (
    cat.includes('freelance') ||
    cat.includes('usaha') ||
    cat.includes('bisnis') ||
    cat.includes('proyek') ||
    cat.includes('gaji') ||
    type === 'Income'
  ) {
    return { name: 'briefcase', bg: COLORS.emeraldLight, color: COLORS.emerald };
  }
  return { name: 'pricetag', bg: '#F3F4F6', color: COLORS.navy };
};

const CategoryBadge = ({ category = '', type = '', size = 38 }) => {
  const cfg = resolveIcon(category, type);
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          backgroundColor: cfg.bg,
        },
      ]}
    >
      <Ionicons name={cfg.name} size={Math.round(size * 0.48)} color={cfg.color} />
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CategoryBadge;
