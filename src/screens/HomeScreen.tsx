import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  FlatList, TextInput, Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useVpn } from '../context/VpnContext';
import { NeonTheme } from '../theme/neonTheme';
import { formatDuration } from '../services/configParser';
import { ConfigRow } from '../components/ConfigRow';
import { AddModal } from '../components/AddModal';
import { SubsModal, ShareModal, SettingsModal, EditModal } from '../components/Modals';

type Filter = 'all' | 'vless' | 'vmess' | 'trojan' | 'ss' | 'sub' | 'manual';

const FILTERS: [Filter, string][] = [
  ['all', 'همه'], ['vless', 'VLESS'], ['vmess', 'VMESS'],
  ['trojan', 'Trojan'], ['ss', 'SS'], ['sub', 'اشتراک'], ['manual', 'دستی'],
];

export const HomeScreen = () => {
  const {
    configs, subs, selectedConfig, status, stats, testingPing, connectError,
    connect, disconnect, selectConfig, removeConfig, testPing, testAllPings,
  } = useVpn();
  const insets = useSafeAreaInsets();

  const [showAdd, setShowAdd] = useState(false);
  const [showSubs, setShowSubs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isError = status === 'error';

  const filtered = useMemo(() => {
    let arr = configs;
    if (filter === 'sub') arr = arr.filter(c => c.subId);
    else if (filter === 'manual') arr = arr.filter(c => !c.subId);
    else if (filter !== 'all') arr = arr.filter(c => c.protocol === filter);
    const q = search.trim().toLowerCase();
    if (q) arr = arr.filter(c => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q));
    return [...arr].sort((a, b) => {
      if (a.id === selectedConfig?.id) return -1;
      if (b.id === selectedConfig?.id) return 1;
      const pa = a.ping === undefined || a.ping === null ? 99999 : a.ping < 0 ? 99998 : a.ping;
      const pb = b.ping === undefined || b.ping === null ? 99999 : b.ping < 0 ? 99998 : b.ping;
      return pa - pb;
    });
  }, [configs, filter, search, selectedConfig]);

  const onToggle = () => {
    if (isConnected || isConnecting) disconnect();
    else {
      if (!selectedConfig) {
        Alert.alert('سروری انتخاب نشده', 'اول با دکمه «افزودن سرور» یک لینک یا اشتراک اضافه کن، بعد یک سرور را لمس کن تا انتخاب شود');
        return;
      }
      connect();
    }
  };

  const onSelect = (id: string) => {
    if (isConnected || isConnecting) {
      Alert.alert('متصلی', 'برای تغییر سرور اول قطع شو');
      return;
    }
    selectConfig(id);
  };

  const onDelete = (id: string, name: string) => {
    Alert.alert('مدیریت سرور', name, [
      { text: 'انصراف', style: 'cancel' },
      { text: 'ویرایش', onPress: () => setEditId(id) },
      { text: 'حذف', style: 'destructive', onPress: () => removeConfig(id) },
    ]);
  };

  const statusColor = isConnected
    ? NeonTheme.colors.connected
    : isConnecting
      ? NeonTheme.colors.connecting
      : isError
        ? NeonTheme.colors.red
        : NeonTheme.colors.disconnected;

  const statusLabel = isConnected ? 'متصل هستی' : isConnecting ? 'در حال اتصال…' : isError ? 'خطا در اتصال' : 'قطع هستی';

  const pingText = selectedConfig?.ping !== undefined && selectedConfig?.ping !== null
    ? selectedConfig.ping < 0 ? 'timeout' : `${selectedConfig.ping} ms`
    : '—';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0618" />

      {/* ── top gradient header (always below notch) ── */}
      <LinearGradient
        colors={['#1b0f3a', '#0f0b26', '#080b11']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[styles.headerBg, { paddingTop: insets.top + 10 }]}
      >
        <SafeAreaView edges={['left', 'right']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.hbtn} onPress={() => setShowSettings(true)} hitSlop={8}>
              <Text style={styles.hbtnText}>⚙️</Text>
            </TouchableOpacity>
            <View style={styles.brand}>
              <LinearGradient colors={['#8b5cf6', '#ec4899']} style={styles.logo}>
                <Text style={styles.logoText}>D</Text>
              </LinearGradient>
              <View>
                <Text style={styles.appName}>Dark VPN</Text>
                <Text style={styles.appSub}>دارک وی‌پی‌ان • اتصال امن</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.hbtn} onPress={() => setShowSubs(true)} hitSlop={8}>
              <Text style={styles.hbtnText}>🔗</Text>
              {subs.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{subs.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── status pill ── */}
          <View style={styles.pillRow}>
            <View style={[styles.pill, { borderColor: statusColor + '55', backgroundColor: statusColor + '14' }]}>
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
              <Text style={[styles.pillText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            {isConnected && (
              <Text style={styles.timer}>{formatDuration(stats.durationSeconds)}</Text>
            )}
          </View>

          {/* ── big power button ── */}
          <View style={styles.powerZone}>
            <TouchableOpacity onPress={onToggle} activeOpacity={0.85} style={styles.powerWrap}>
              <LinearGradient
                colors={
                  isConnected
                    ? NeonTheme.gradients.powerConnected
                    : isConnecting
                      ? NeonTheme.gradients.powerConnecting
                      : (['#4c1d95', '#7c3aed'] as [string, string])
                }
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.powerRing}
              >
                <View style={styles.powerInner}>
                  {isConnecting ? (
                    <ActivityIndicator size="large" color={NeonTheme.colors.connecting} />
                  ) : (
                    <>
                      <Text style={styles.powerIcon}>{isConnected ? '⏻' : '⏻'}</Text>
                      <Text style={[styles.powerLabel, { color: isConnected ? NeonTheme.colors.connected : '#c4b5fd' }]}>
                        {isConnected ? 'قطع کن' : 'وصل شو'}
                      </Text>
                    </>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.serverName} numberOfLines={1}>
              {selectedConfig ? `▸ ${selectedConfig.name}` : 'هنوز سروری انتخاب نکردی'}
            </Text>
          </View>

          {/* ── stat tiles ── */}
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>↓ دانلود</Text>
              <Text style={styles.tileVal}>{isConnected ? stats.downloadSpeed : '—'}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>پینگ</Text>
              <Text style={[styles.tileVal, { color: NeonTheme.colors.emerald }]} numberOfLines={1}>{pingText}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>↑ آپلود</Text>
              <Text style={styles.tileVal}>{isConnected ? stats.uploadSpeed : '—'}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {isError && !!connectError && (
        <View style={styles.errBox}>
          <Text style={styles.errName} numberOfLines={2}>⚠ {connectError}</Text>
        </View>
      )}

      {/* ── quick actions ── */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={() => setShowAdd(true)}>
          <Text style={styles.actionIcon}>＋</Text>
          <Text style={styles.actionLabel}>افزودن</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.action}
          onPress={() => { testAllPings(); }}
          disabled={testingPing || configs.length === 0}
        >
          {testingPing
            ? <ActivityIndicator size="small" color={NeonTheme.colors.cyan} />
            : <Text style={styles.actionIcon}>⚡</Text>}
          <Text style={styles.actionLabel}>تست همه</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => setShowSubs(true)}>
          <Text style={styles.actionIcon}>🔗</Text>
          <Text style={styles.actionLabel}>اشتراک‌ها{subs.length > 0 ? ` (${subs.length})` : ''}</Text>
        </TouchableOpacity>
      </View>

      {/* ── search ── */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="جستجوی سرور…"
          placeholderTextColor={NeonTheme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* ── section + filters ── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>سرورها</Text>
        <Text style={styles.sectionCount}>{configs.length} سرور</Text>
      </View>
      <View style={styles.chips}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={([k]) => k}
          showsHorizontalScrollIndicator={false}
          inverted
          renderItem={({ item: [k, label] }) => (
            <TouchableOpacity
              style={[styles.chip, filter === k && styles.chipActive]}
              onPress={() => setFilter(k)}
            >
              <Text style={[styles.chipText, filter === k && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ── list ── */}
      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={c => c.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <LinearGradient colors={['#8b5cf6', '#ec4899']} style={styles.emptyIconWrap}>
              <Text style={styles.emptyIcon}>🛰️</Text>
            </LinearGradient>
            <Text style={styles.emptyTitle}>هنوز سروری نداری</Text>
            <Text style={styles.emptySub}>لینک کانفیگ یا اشتراکت را اضافه کن تا شروع کنیم</Text>
            <TouchableOpacity onPress={() => setShowAdd(true)}>
              <LinearGradient colors={NeonTheme.gradients.brandButton} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>＋ افزودن سرور</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <ConfigRow
            cfg={item}
            selected={item.id === selectedConfig?.id}
            onSelect={() => onSelect(item.id)}
            onPing={() => testPing(item.id)}
            onDelete={() => onDelete(item.id, item.name)}
            onShare={() => setShareId(item.id)}
          />
        )}
      />

      <AddModal visible={showAdd} onClose={() => setShowAdd(false)} />
      <SubsModal visible={showSubs} onClose={() => setShowSubs(false)} />
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      <ShareModal configId={shareId} onClose={() => setShareId(null)} />
      <EditModal configId={editId} onClose={() => setEditId(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080b11' },
  headerBg: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingBottom: 4,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  appName: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  appSub: { fontSize: 11, color: '#a78bfa', marginTop: 1 },
  hbtn: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  hbtnText: { fontSize: 20 },
  countBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ec4899', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  pillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },
  timer: { color: NeonTheme.colors.textMuted, fontSize: 12, fontFamily: NeonTheme.typography.fontMono },

  powerZone: { alignItems: 'center', marginTop: 12 },
  powerWrap: { width: 148, height: 148, borderRadius: 74 },
  powerRing: { flex: 1, borderRadius: 74, padding: 5 },
  powerInner: { flex: 1, backgroundColor: '#0f0b26', borderRadius: 70, justifyContent: 'center', alignItems: 'center' },
  powerIcon: { fontSize: 42, color: '#fff' },
  powerLabel: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  serverName: { color: NeonTheme.colors.textSecondary, fontSize: 13, marginTop: 10, paddingHorizontal: 30 },

  tiles: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 12, paddingBottom: 18 },
  tile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tileLabel: { color: NeonTheme.colors.textMuted, fontSize: 11 },
  tileVal: { color: NeonTheme.colors.cyan, fontSize: 14, fontWeight: '800', marginTop: 3, fontFamily: NeonTheme.typography.fontMono },

  errBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 10, marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' },
  errName: { color: NeonTheme.colors.red, fontSize: 12, textAlign: 'center' },

  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: NeonTheme.colors.bgCard, borderRadius: 16, paddingVertical: 13, borderWidth: 1, borderColor: NeonTheme.colors.border },
  actionIcon: { color: NeonTheme.colors.purple, fontSize: 17, fontWeight: '800' },
  actionLabel: { color: NeonTheme.colors.textPrimary, fontSize: 13, fontWeight: '700' },

  searchRow: { paddingHorizontal: 16, marginTop: 10 },
  search: {
    backgroundColor: NeonTheme.colors.bgCard, borderRadius: 16, paddingHorizontal: 16,
    paddingVertical: 12, color: NeonTheme.colors.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: NeonTheme.colors.border, textAlign: 'right',
  },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 14, marginBottom: 2 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  sectionCount: { color: NeonTheme.colors.textMuted, fontSize: 12 },

  chips: { paddingLeft: 16, marginVertical: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18, backgroundColor: NeonTheme.colors.bgCard, marginRight: 8, borderWidth: 1, borderColor: NeonTheme.colors.border },
  chipActive: { backgroundColor: NeonTheme.colors.purple, borderColor: NeonTheme.colors.purple },
  chipText: { color: NeonTheme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  list: { flex: 1, paddingHorizontal: 16 },

  empty: { alignItems: 'center', marginTop: 40, paddingHorizontal: 24 },
  emptyIconWrap: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: '#fff', fontSize: 19, fontWeight: '800', marginTop: 14 },
  emptySub: { color: NeonTheme.colors.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center' },
  emptyBtn: { borderRadius: 16, paddingHorizontal: 28, paddingVertical: 13, marginTop: 18 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
