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
    // sort: selected first, then ping asc (timeouts last)
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
      if (!selectedConfig) { Alert.alert('سروری انتخاب نشده', 'اول با دکمه ＋ یک لینک یا اشتراک اضافه کن، بعد یک سرور را لمس کن تا انتخاب شود'); return; }
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

  const statusLabel = isConnected ? 'متصل' : isConnecting ? 'در حال اتصال…' : isError ? 'خطا در اتصال' : 'قطع';

  const FILTERS: [Filter, string][] = [
    ['all', 'همه'], ['vless', 'VLESS'], ['vmess', 'VMESS'],
    ['trojan', 'Trojan'], ['ss', 'SS'], ['sub', 'اشتراک'], ['manual', 'دستی'],
  ];

  const pingText = selectedConfig?.ping !== undefined && selectedConfig?.ping !== null
    ? selectedConfig.ping < 0 ? 'timeout' : `${selectedConfig.ping} ms`
    : '—';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={NeonTheme.colors.bgApp} />

      {/* ── header: brand always visible below notch ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top > 0 ? 4 : 10, 4) }]}>
        <TouchableOpacity style={styles.hbtn} onPress={() => setShowSettings(true)} hitSlop={8}>
          <Text style={styles.hbtnText}>⚙️</Text>
        </TouchableOpacity>
        <View style={styles.brand}>
          <LinearGradient colors={NeonTheme.gradients.titleGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.logoDot}>
            <Text style={styles.logoText}>D</Text>
          </LinearGradient>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>Dark VPN</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
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

      {/* ── hero connect card ── */}
      <View style={styles.heroWrap}>
        <LinearGradient
          colors={isConnected ? ['#06ffa5', '#00f2fe'] : isConnecting ? ['#f59e0b', '#ec4899'] : ['#2a3350', '#1a2140']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.heroBorder}
        >
          <View style={styles.heroInner}>
            <TouchableOpacity onPress={onToggle} activeOpacity={0.85} style={styles.powerWrap}>
              <LinearGradient
                colors={
                  isConnected
                    ? NeonTheme.gradients.powerConnected
                    : isConnecting
                      ? NeonTheme.gradients.powerConnecting
                      : NeonTheme.gradients.powerDisconnected
                }
                style={styles.powerRing}
              >
                <View style={styles.powerInner}>
                  {isConnecting ? (
                    <ActivityIndicator size="large" color={NeonTheme.colors.connecting} />
                  ) : (
                    <>
                      <Text style={styles.powerIcon}>{isConnected ? '⏻' : '○'}</Text>
                      <Text style={[styles.powerLabel, { color: statusColor }]}>
                        {isConnected ? 'متصل' : 'اتصال'}
                      </Text>
                    </>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.heroInfo}>
              <Text style={styles.heroServerLabel}>سرور فعال</Text>
              <Text style={styles.heroServer} numberOfLines={1}>
                {selectedConfig ? selectedConfig.name : 'سروری انتخاب نشده'}
              </Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>↓ {isConnected ? stats.downloadSpeed : '—'}</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatVal, { color: NeonTheme.colors.emerald }]}>{pingText}</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>↑ {isConnected ? stats.uploadSpeed : '—'}</Text>
                </View>
              </View>
              <Text style={styles.heroTimer}>{isConnected ? formatDuration(stats.durationSeconds) : 'برای اتصال، دکمه بالا را بزن'}</Text>
            </View>
          </View>
        </LinearGradient>
        {isError && !!connectError && (
          <View style={styles.errBox}>
            <Text style={styles.errName} numberOfLines={2}>⚠ {connectError}</Text>
          </View>
        )}
      </View>

      {/* ── search + test all ── */}
      <View style={styles.toolsRow}>
        <TextInput
          style={styles.search}
          placeholder="جستجوی سرور…"
          placeholderTextColor={NeonTheme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={styles.testAll}
          onPress={() => { testAllPings(); }}
          disabled={testingPing || configs.length === 0}
        >
          {testingPing
            ? <ActivityIndicator size="small" color={NeonTheme.colors.cyan} />
            : <Text style={styles.testAllText}>⚡ تست همه</Text>}
        </TouchableOpacity>
      </View>

      {/* ── section title ── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>سرورها</Text>
        <Text style={styles.sectionCount}>
          {configs.length} سرور{subs.length > 0 ? ` • ${subs.length} اشتراک` : ''}
        </Text>
      </View>

      {/* ── filter chips ── */}
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

      {/* ── config list ── */}
      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={c => c.id}
        contentContainerStyle={{ paddingBottom: 110 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🛰️</Text>
            <Text style={styles.emptyTitle}>هنوز سروری نداری</Text>
            <Text style={styles.emptySub}>با دکمه ＋ پایین، لینک یا اشتراک اضافه کن</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyBtnText}>＋ افزودن سرور</Text>
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

      {/* ── bottom bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Text style={styles.bottomHint}>برای اتصال یک سرور را لمس کن</Text>
        <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)} hitSlop={6}>
          <LinearGradient colors={NeonTheme.gradients.brandButton} style={styles.fabGrad}>
            <Text style={styles.fabText}>＋</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <AddModal visible={showAdd} onClose={() => setShowAdd(false)} />
      <SubsModal visible={showSubs} onClose={() => setShowSubs(false)} />
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      <ShareModal configId={shareId} onClose={() => setShareId(null)} />
      <EditModal configId={editId} onClose={() => setEditId(null)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NeonTheme.colors.bgApp },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#000', fontSize: 20, fontWeight: '900' },
  title: { fontSize: 20, fontWeight: '900', color: NeonTheme.colors.textPrimary, letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
  hbtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: NeonTheme.colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: NeonTheme.colors.border },
  hbtnText: { fontSize: 20, color: NeonTheme.colors.textPrimary },
  countBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: NeonTheme.colors.purple, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  heroWrap: { paddingHorizontal: 16, marginTop: 2 },
  heroBorder: { borderRadius: 20, padding: 1.5 },
  heroInner: { backgroundColor: '#0c1222', borderRadius: 19, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  powerWrap: { width: 104, height: 104, borderRadius: 52 },
  powerRing: { flex: 1, borderRadius: 52, padding: 4 },
  powerInner: { flex: 1, backgroundColor: '#0c1222', borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  powerIcon: { fontSize: 30, color: NeonTheme.colors.textPrimary },
  powerLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  heroInfo: { flex: 1 },
  heroServerLabel: { color: NeonTheme.colors.textMuted, fontSize: 11 },
  heroServer: { color: NeonTheme.colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 2 },
  heroStats: { flexDirection: 'row', gap: 12, marginTop: 8 },
  heroStat: { backgroundColor: NeonTheme.colors.bgCard, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: NeonTheme.colors.border },
  heroStatVal: { color: NeonTheme.colors.cyan, fontSize: 12, fontWeight: '700', fontFamily: NeonTheme.typography.fontMono },
  heroTimer: { color: NeonTheme.colors.textMuted, fontSize: 11, marginTop: 6 },
  errBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 10, marginTop: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' },
  errName: { color: NeonTheme.colors.red, fontSize: 12, textAlign: 'center' },

  toolsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, gap: 10 },
  search: {
    flex: 1, backgroundColor: NeonTheme.colors.bgCard, borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 12, color: NeonTheme.colors.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: NeonTheme.colors.border, textAlign: 'right',
  },
  testAll: { backgroundColor: NeonTheme.colors.bgCard, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: NeonTheme.colors.border, minHeight: 48 },
  testAllText: { color: NeonTheme.colors.cyan, fontWeight: '700', fontSize: 13 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginTop: 14, marginBottom: 2 },
  sectionTitle: { color: NeonTheme.colors.textPrimary, fontSize: 16, fontWeight: '800' },
  sectionCount: { color: NeonTheme.colors.textMuted, fontSize: 12 },

  chips: { paddingLeft: 16, marginVertical: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18, backgroundColor: NeonTheme.colors.bgCard, marginRight: 8, borderWidth: 1, borderColor: NeonTheme.colors.border },
  chipActive: { backgroundColor: NeonTheme.colors.purple, borderColor: NeonTheme.colors.purple },
  chipText: { color: NeonTheme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { alignItems: 'center', marginTop: 44, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { color: NeonTheme.colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 12 },
  emptySub: { color: NeonTheme.colors.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center' },
  emptyBtn: { backgroundColor: NeonTheme.colors.purple, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12, marginTop: 16 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10,
    backgroundColor: NeonTheme.colors.bgApp + 'F2', borderTopWidth: 1, borderColor: NeonTheme.colors.border,
  },
  bottomHint: { color: NeonTheme.colors.textMuted, fontSize: 12 },
  fab: { width: 60, height: 60, borderRadius: 30, marginTop: -34, elevation: 6 },
  fabGrad: { flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  fabText: { color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -3 },
});
