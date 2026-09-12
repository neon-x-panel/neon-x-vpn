import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, SafeAreaView,
  FlatList, TextInput, Alert, ActivityIndicator, StatusBar,
} from 'react-native';
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
      if (!selectedConfig) { Alert.alert('کانفیگی انتخاب نشده', 'اول یک کانفیگ اضافه و انتخاب کن'); return; }
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
    Alert.alert('حذف کانفیگ', name, [
      { text: 'انصراف', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => removeConfig(id) },
      { text: 'ویرایش', onPress: () => setEditId(id) },
    ]);
  };

  const statusColor = isConnected
    ? NeonTheme.colors.connected
    : isConnecting
      ? NeonTheme.colors.connecting
      : isError
        ? NeonTheme.colors.red
        : NeonTheme.colors.disconnected;

  const FILTERS: [Filter, string][] = [
    ['all', 'همه'], ['vless', 'VLESS'], ['vmess', 'VMESS'],
    ['trojan', 'Trojan'], ['ss', 'SS'], ['sub', 'ساب'], ['manual', 'دستی'],
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NeonTheme.colors.bgApp} />

      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.hbtn} onPress={() => setShowSettings(true)}>
          <Text style={styles.hbtnText}>⚙</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.title}>NEON X</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isConnected ? 'متصل' : isConnecting ? 'در حال اتصال...' : isError ? 'خطا' : 'قطع'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.hbtn} onPress={() => setShowSubs(true)}>
          <Text style={styles.hbtnText}>🔗</Text>
          {subs.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{subs.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* connect panel */}
      <View style={styles.panel}>
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

        <View style={styles.speedRow}>
          <View style={styles.speedBox}>
            <Text style={styles.speedLabel}>↓ دانلود</Text>
            <Text style={styles.speedVal}>{isConnected ? stats.downloadSpeed : '—'}</Text>
          </View>
          <View style={styles.speedBox}>
            <Text style={styles.pingBig} numberOfLines={1}>
              {selectedConfig?.ping !== undefined && selectedConfig?.ping !== null
                ? selectedConfig.ping < 0 ? 'timeout' : `${selectedConfig.ping} ms`
                : '—'}
            </Text>
            <Text style={styles.speedLabel}>{formatDuration(stats.durationSeconds)}</Text>
          </View>
          <View style={styles.speedBox}>
            <Text style={styles.speedLabel}>↑ آپلود</Text>
            <Text style={styles.speedVal}>{isConnected ? stats.uploadSpeed : '—'}</Text>
          </View>
        </View>

        {selectedConfig && (
          <Text style={styles.selName} numberOfLines={1}>
            ▸ {selectedConfig.name}
          </Text>
        )}
        {isError && connectError && (
          <Text style={styles.errName} numberOfLines={2}>
            ⚠ {connectError}
          </Text>
        )}
      </View>

      {/* search + test all */}
      <View style={styles.toolsRow}>
        <TextInput
          style={styles.search}
          placeholder="جستجو..."
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

      {/* filter chips */}
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

      {/* config list */}
      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={c => c.id}
        contentContainerStyle={{ paddingBottom: 90 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>کانفیگی نیست</Text>
            <Text style={styles.emptySub}>با دکمه + لینک یا ساب اضافه کن</Text>
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

      {/* bottom bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.bottomText}>
          {configs.length} کانفیگ{subs.length > 0 ? ` • ${subs.length} ساب` : ''}
        </Text>
        <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
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
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6,
  },
  title: { fontSize: 22, fontWeight: '900', color: NeonTheme.colors.textPrimary, letterSpacing: 3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
  hbtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: NeonTheme.colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: NeonTheme.colors.border },
  hbtnText: { fontSize: 19, color: NeonTheme.colors.textPrimary },
  countBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: NeonTheme.colors.purple, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  panel: { alignItems: 'center', paddingVertical: 10 },
  powerWrap: { width: 168, height: 168, borderRadius: 84 },
  powerRing: { flex: 1, borderRadius: 84, padding: 5 },
  powerInner: { flex: 1, backgroundColor: NeonTheme.colors.bgApp, borderRadius: 80, justifyContent: 'center', alignItems: 'center' },
  powerIcon: { fontSize: 44, color: NeonTheme.colors.textPrimary },
  powerLabel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  speedRow: { flexDirection: 'row', width: '100%', paddingHorizontal: 24, marginTop: 12, justifyContent: 'space-between' },
  speedBox: { alignItems: 'center', minWidth: 80 },
  speedLabel: { color: NeonTheme.colors.textMuted, fontSize: 11, marginTop: 2 },
  speedVal: { color: NeonTheme.colors.cyan, fontSize: 15, fontWeight: '700', fontFamily: NeonTheme.typography.fontMono },
  pingBig: { color: NeonTheme.colors.emerald, fontSize: 17, fontWeight: '800', fontFamily: NeonTheme.typography.fontMono },
  selName: { color: NeonTheme.colors.textSecondary, fontSize: 12, marginTop: 8, paddingHorizontal: 24 },
  errName: { color: NeonTheme.colors.red, fontSize: 12, marginTop: 6, paddingHorizontal: 24, textAlign: 'center' },
  toolsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 8, gap: 10 },
  search: {
    flex: 1, backgroundColor: NeonTheme.colors.bgCard, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, color: NeonTheme.colors.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: NeonTheme.colors.border, textAlign: 'right',
  },
  testAll: { backgroundColor: NeonTheme.colors.bgCard, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: NeonTheme.colors.border },
  testAllText: { color: NeonTheme.colors.cyan, fontWeight: '700', fontSize: 13 },
  chips: { paddingLeft: 16, marginVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: NeonTheme.colors.bgCard, marginRight: 8, borderWidth: 1, borderColor: NeonTheme.colors.border },
  chipActive: { backgroundColor: NeonTheme.colors.purple, borderColor: NeonTheme.colors.purple },
  chipText: { color: NeonTheme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { alignItems: 'center', marginTop: 50 },
  emptyTitle: { color: NeonTheme.colors.textPrimary, fontSize: 17, fontWeight: '700' },
  emptySub: { color: NeonTheme.colors.textMuted, fontSize: 13, marginTop: 6 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 22,
    backgroundColor: NeonTheme.colors.bgApp + 'F2', borderTopWidth: 1, borderColor: NeonTheme.colors.border,
  },
  bottomText: { color: NeonTheme.colors.textMuted, fontSize: 12 },
  fab: { width: 58, height: 58, borderRadius: 29, marginTop: -34 },
  fabGrad: { flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  fabText: { color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -3 },
});
