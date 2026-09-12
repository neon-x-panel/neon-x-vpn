import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useVpn } from '../context/VpnContext';
import { NeonTheme } from '../theme/neonTheme';
import { protoColor, protoLabel, VpnConfig } from '../services/configParser';

function pingColor(p?: number) {
  if (p === undefined || p === null || p < 0) return NeonTheme.colors.red;
  if (p < 150) return NeonTheme.colors.connected;
  if (p < 400) return NeonTheme.colors.connecting;
  return NeonTheme.colors.red;
}

export const ConfigRow = ({
  cfg,
  selected,
  onSelect,
  onPing,
  onDelete,
  onShare,
}: {
  cfg: VpnConfig;
  selected: boolean;
  onSelect: () => void;
  onPing: () => void;
  onDelete: () => void;
  onShare: () => void;
}) => (
  <TouchableOpacity
    style={[styles.row, selected && styles.rowSelected]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <View style={[styles.badge, { backgroundColor: protoColor(cfg.protocol) + '22', borderColor: protoColor(cfg.protocol) }]}>
      <Text style={[styles.badgeText, { color: protoColor(cfg.protocol) }]}>{protoLabel(cfg.protocol)}</Text>
    </View>
    <View style={styles.info}>
      <Text style={styles.name} numberOfLines={2}>{cfg.name}</Text>
      <Text style={styles.addr} numberOfLines={1}>
        {cfg.address}:{cfg.port}{cfg.subName ? `  •  ${cfg.subName}` : ''}
      </Text>
    </View>
    <TouchableOpacity onPress={onPing} style={styles.pingBox}>
      <Text style={[styles.ping, { color: pingColor(cfg.ping) }]}>
        {cfg.ping === undefined || cfg.ping === null ? '—' : cfg.ping < 0 ? '✕' : `${cfg.ping}`}
      </Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={onShare} style={styles.iconBtn}>
      <Text style={styles.iconText}>⧉</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
      <Text style={[styles.iconText, { color: NeonTheme.colors.red }]}>✕</Text>
    </TouchableOpacity>
    {selected && <View style={styles.selDot} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NeonTheme.colors.bgCard,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: NeonTheme.colors.border,
  },
  rowSelected: { borderColor: NeonTheme.colors.cyan, backgroundColor: NeonTheme.colors.bgCardElevated },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginRight: 10,
    minWidth: 52,
    alignItems: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  info: { flex: 1, marginRight: 6 },
  name: { color: NeonTheme.colors.textPrimary, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  addr: { color: NeonTheme.colors.textMuted, fontSize: 10, marginTop: 2, fontFamily: NeonTheme.typography.fontMono },
  pingBox: { minWidth: 44, alignItems: 'flex-end', marginRight: 4 },
  ping: { fontSize: 13, fontWeight: '700', fontFamily: NeonTheme.typography.fontMono },
  iconBtn: { padding: 6 },
  iconText: { color: NeonTheme.colors.textSecondary, fontSize: 15 },
  selDot: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: NeonTheme.colors.cyan,
  },
});
