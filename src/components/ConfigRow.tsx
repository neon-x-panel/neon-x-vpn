import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useVpn } from '../context/VpnContext';
import { NeonTheme } from '../theme/neonTheme';
import { protoColor, protoLabel, VpnConfig } from '../services/configParser';

function pingColor(p?: number) {
  if (p === undefined || p === null || p < 0) return NeonTheme.colors.red;
  if (p < 150) return NeonTheme.colors.connected;
  if (p < 400) return NeonTheme.colors.connecting;
  return NeonTheme.colors.red;
}

function pingText(p?: number) {
  if (p === undefined || p === null) return '—';
  if (p < 0) return '✕';
  return `${p}`;
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
}) => {
  const pc = pingColor(cfg.ping);
  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {selected && <View style={styles.selBar} />}
      <View style={styles.main}>
        <View style={styles.topRow}>
          <View style={[styles.badge, { backgroundColor: protoColor(cfg.protocol) + '22', borderColor: protoColor(cfg.protocol) }]}>
            <Text style={[styles.badgeText, { color: protoColor(cfg.protocol) }]}>{protoLabel(cfg.protocol)}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{cfg.name}</Text>
        </View>
        <Text style={styles.addr} numberOfLines={1}>
          {cfg.address}:{cfg.port}{cfg.subName ? `  •  ${cfg.subName}` : ''}
        </Text>
      </View>
      <View style={styles.side}>
        <TouchableOpacity onPress={onPing} style={[styles.pingPill, { borderColor: pc + '66', backgroundColor: pc + '14' }]}>
          <Text style={[styles.ping, { color: pc }]}>{pingText(cfg.ping)}</Text>
          <Text style={[styles.pingUnit, { color: pc }]}>ms</Text>
        </TouchableOpacity>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onShare} style={styles.iconBtn} hitSlop={8}>
            <Text style={styles.iconText}>⧉</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.iconBtn} hitSlop={8}>
            <Text style={[styles.iconText, { color: NeonTheme.colors.red }]}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NeonTheme.colors.bgCard,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: NeonTheme.colors.border,
    overflow: 'hidden',
  },
  rowSelected: {
    borderColor: NeonTheme.colors.cyan,
    backgroundColor: NeonTheme.colors.bgCardElevated,
    shadowColor: NeonTheme.colors.cyan,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  selBar: {
    position: 'absolute',
    right: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderRadius: 2,
    backgroundColor: NeonTheme.colors.cyan,
  },
  main: { flex: 1, marginRight: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 54,
    alignItems: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  name: { flex: 1, color: NeonTheme.colors.textPrimary, fontSize: 14, fontWeight: '700' },
  addr: { color: NeonTheme.colors.textMuted, fontSize: 11, marginTop: 5, fontFamily: NeonTheme.typography.fontMono },
  side: { alignItems: 'flex-end', gap: 6 },
  pingPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 64,
    justifyContent: 'center',
  },
  ping: { fontSize: 15, fontWeight: '800', fontFamily: NeonTheme.typography.fontMono },
  pingUnit: { fontSize: 9, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 2 },
  iconBtn: { padding: 6 },
  iconText: { color: NeonTheme.colors.textSecondary, fontSize: 16 },
});
