import React, { useState } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, TextInput, Alert, ScrollView, Linking } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Updates from 'expo-updates';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Clipboard from 'expo-clipboard';
import { useVpn } from '../context/VpnContext';
import { NeonTheme } from '../theme/neonTheme';

export const SubsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { subs, removeSubscription, refreshSubscription, refreshAllSubs } = useVpn();
  const [busy, setBusy] = useState<string | null>(null);

  const doRefresh = async (id: string) => {
    setBusy(id);
    try {
      const n = await refreshSubscription(id);
      Alert.alert('موفق', `${n} کانفیگ به‌روز شد`);
    } catch (e: any) {
      Alert.alert('خطا', e?.message || 'به‌روزرسانی ناموفق');
    } finally {
      setBusy(null);
    }
  };

  const doRefreshAll = async () => {
    setBusy('all');
    try {
      const n = await refreshAllSubs();
      Alert.alert('موفق', `مجموع ${n} کانفیگ`);
    } finally {
      setBusy(null);
    }
  };

  const copyUrl = async (url: string) => {
    await Clipboard.setStringAsync(url);
    Alert.alert('کپی شد');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>سابسکریپشن‌ها ({subs.length})</Text>
          {subs.length > 0 && (
            <TouchableOpacity style={styles.refreshAll} onPress={doRefreshAll} disabled={busy !== null}>
              <Text style={styles.refreshAllText}>{busy === 'all' ? 'در حال به‌روزرسانی...' : '↻ به‌روزرسانی همه'}</Text>
            </TouchableOpacity>
          )}
          <ScrollView style={{ maxHeight: 420 }}>
            {subs.length === 0 && <Text style={styles.empty}>سابی اضافه نشده — از دکمه + اضافه کن</Text>}
            {subs.map(s => (
              <View key={s.id} style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{s.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{s.url}</Text>
                    <Text style={styles.meta}>{s.count} کانفیگ • {new Date(s.lastUpdated).toLocaleDateString('fa-IR')}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.abtn} onPress={() => copyUrl(s.url)}>
                    <Text style={styles.abtnText}>کپی لینک</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.abtn} onPress={() => doRefresh(s.id)} disabled={busy !== null}>
                    <Text style={styles.abtnText}>{busy === s.id ? '...' : 'به‌روزرسانی'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.abtn, styles.del]}
                    onPress={() => Alert.alert('حذف ساب', 'کانفیگ‌های این ساب هم پاک شود؟', [
                      { text: 'انصراف', style: 'cancel' },
                      { text: 'حذف', style: 'destructive', onPress: () => removeSubscription(s.id) },
                    ])}
                  >
                    <Text style={[styles.abtnText, { color: NeonTheme.colors.red }]}>حذف</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>بستن</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const ShareModal = ({ configId, onClose }: { configId: string | null; onClose: () => void }) => {
  const { configs } = useVpn();
  const cfg = configs.find(c => c.id === configId);
  const [showQr, setShowQr] = useState(true);

  const copy = async () => {
    if (!cfg) return;
    await Clipboard.setStringAsync(cfg.raw);
    Alert.alert('کپی شد');
  };

  return (
    <Modal visible={!!configId} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlayCenter}>
        <View style={styles.shareBox}>
          <Text style={styles.title} numberOfLines={1}>{cfg?.name || ''}</Text>
          {cfg && showQr && (
            <View style={styles.qrWrap}>
              <QRCode value={cfg.raw} size={220} backgroundColor="#fff" color="#000" />
            </View>
          )}
          {cfg && !showQr && (
            <ScrollView style={styles.rawBox}>
              <Text style={styles.rawText}>{cfg.raw}</Text>
            </ScrollView>
          )}
          {cfg && (
            <Text style={styles.meta}>
              {cfg.protocol.toUpperCase()} • {cfg.address}:{cfg.port}
            </Text>
          )}
          <View style={styles.actions}>
            {cfg && (
              <TouchableOpacity style={styles.abtn} onPress={() => setShowQr(!showQr)}>
                <Text style={styles.abtnText}>{showQr ? 'نمایش متن' : 'نمایش QR'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.abtn} onPress={copy}>
              <Text style={styles.abtnText}>کپی لینک</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => { setShowQr(true); onClose(); }}>
            <Text style={styles.closeText}>بستن</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const SettingsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { routingMode, setRoutingMode, dnsMode, setDnsMode, killSwitch, setKillSwitch, clearAll, language, setLanguage } = useVpn();
  const [confirmClear, setConfirmClear] = useState(false);
  const [update, setUpdate] = useState<{ available: boolean; url?: string; version?: string; apkUrl?: string; ota?: boolean } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const checkUpdate = async () => {
    // 1. OTA patch (small, JS-only changes)
    try {
      const ota = await Updates.checkForUpdateAsync();
      if (ota.isAvailable) {
        setUpdate({ available: true, version: 'پچ جدید', ota: true });
        return;
      }
    } catch { /* offline or updates not configured — fall through to APK check */ }
    // 2. Full APK (native changes)
    try {
      const resp = await fetch('https://api.github.com/repos/neon-x-panel/neon-x-vpn/releases/latest');
      const data = await resp.json();
      const latest = data.tag_name; // e.g. "2.2.6"
      const current = '2.2.5';
      const apk = (data.assets || []).find((a: any) => a.name?.endsWith('.apk'));
      const apkUrl = apk?.browser_download_url;
      if (latest && latest !== current) {
        setUpdate({ available: true, url: data.html_url, version: latest, apkUrl });
      } else {
        Alert.alert('آپدیت', 'شما از آخرین نسخه استفاده می‌کنید');
      }
    } catch {
      Alert.alert('خطا', 'بررسی به‌روزرسانی ناموفق بود');
    }
  };

  const applyUpdate = async () => {
    // OTA patch: download small JS bundle and restart
    if (update?.ota) {
      try {
        setDownloading(true);
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch (e: any) {
        setDownloading(false);
        Alert.alert('خطا', 'دریافت پچ ناموفق بود: ' + (e?.message || ''));
      }
      return;
    }
    await downloadAndInstall();
  };

  const downloadAndInstall = async () => {
    if (!update?.apkUrl) {
      Alert.alert('خطا', 'فایل APK در ریلیز گیت‌هاب پیدا نشد');
      if (update?.url) Linking.openURL(update.url);
      return;
    }
    try {
      setDownloading(true);
      setProgress(0);
      const fileUri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + `darkvpn-${update.version}.apk`;
      const dl = FileSystem.createDownloadResumable(update.apkUrl, fileUri, {}, (p: any) => {
        if (p.totalBytesWritten && p.totalBytesExpectedToWrite) {
          setProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
        }
      });
      const result: any = await dl.downloadAsync();
      setDownloading(false);
      if (!result?.uri) throw new Error('download failed');
      const cUri = await FileSystem.getContentUriAsync(result.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: cUri,
        flags: 1,
        type: 'application/vnd.android.package-archive',
      });
    } catch (e: any) {
      setDownloading(false);
      Alert.alert('خطا', 'دانلود یا نصب ناموفق بود: ' + (e?.message || ''));
    }
  };

  const Row = ({ label, options, value, onPick }: { label: string; options: [string, string][]; value: string; onPick: (v: any) => void }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map(([v, l]) => (
          <TouchableOpacity
            key={v}
            style={[styles.abtn, { flex: 1, alignItems: 'center' }, value === v && styles.abtnActive]}
            onPress={() => onPick(v)}
          >
            <Text style={[styles.abtnText, value === v && { color: '#000' }]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>تنظیمات</Text>
          {update?.available && (
            <TouchableOpacity disabled={downloading} style={{ backgroundColor: '#f1c40f', padding: 12, borderRadius: 12, marginBottom: 12, alignItems: 'center', opacity: downloading ? 0.7 : 1 }} onPress={applyUpdate}>
              <Text style={{ color: '#000', fontWeight: 'bold' }}>
                {downloading
                  ? (update?.ota ? 'در حال دریافت پچ…' : `در حال دانلود… ${Math.round(progress * 100)}٪`)
                  : (update?.ota ? 'دریافت پچ جدید (سریع)' : `دانلود و نصب نسخه ${update.version}`)}
              </Text>
            </TouchableOpacity>
          )}
          <ScrollView>
            <TouchableOpacity style={[styles.abtn, { alignItems: 'center', marginBottom: 16, borderColor: NeonTheme.colors.purple, backgroundColor: NeonTheme.colors.bgCardElevated }]} onPress={checkUpdate}>
                <Text style={[styles.abtnText, { color: NeonTheme.colors.purple, fontSize: 14 }]}>🔄 بررسی برای به‌روزرسانی (Update Check)</Text>
            </TouchableOpacity>
            <Row
              label="زبان / Language"
              value={language}
              onPick={setLanguage}
              options={[['fa', 'فارسی'], ['en', 'English']]}
            />
            <Row
              label="مسیریابی"
              value={routingMode}
              onPick={setRoutingMode}
              options={[['bypass_iran', 'حذف ایران'], ['global', 'گلوبال'], ['direct', 'مستقیم']]}
            />
            <Row
              label="DNS"
              value={dnsMode}
              onPick={setDnsMode}
              options={[['cloudflare', '1.1.1.1'], ['google', '8.8.8.8'], ['system', 'سیستم']]}
            />
            <View style={styles.killRow}>
              <Text style={styles.label}>کیل‌سوییچ</Text>
              <TouchableOpacity
                style={[styles.switch, killSwitch && styles.switchOn]}
                onPress={() => setKillSwitch(!killSwitch)}
              >
                <View style={[styles.knob, killSwitch && styles.knobOn]} />
              </TouchableOpacity>
            </View>
            <View style={{ height: 12 }} />
            {!confirmClear ? (
              <TouchableOpacity style={[styles.abtn, styles.del, { alignItems: 'center' }]} onPress={() => setConfirmClear(true)}>
                <Text style={[styles.abtnText, { color: NeonTheme.colors.red }]}>حذف همه کانفیگ‌ها</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={[styles.abtn, { flex: 1, alignItems: 'center' }]} onPress={() => setConfirmClear(false)}>
                  <Text style={styles.abtnText}>انصراف</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.abtn, styles.del, { flex: 1, alignItems: 'center', backgroundColor: NeonTheme.colors.red }]}
                  onPress={() => { clearAll(); setConfirmClear(false); onClose(); }}
                >
                  <Text style={[styles.abtnText, { color: '#fff' }]}>تأیید حذف</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>بستن</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const EditModal = ({ configId, onClose }: { configId: string | null; onClose: () => void }) => {
  const { configs, updateConfig } = useVpn();
  const cfg = configs.find(c => c.id === configId);
  const [name, setName] = useState('');

  React.useEffect(() => {
    if (cfg) setName(cfg.name);
  }, [configId]);

  const save = () => {
    if (!cfg) return;
    updateConfig(cfg.id, { name: name.trim() || cfg.name });
    onClose();
  };

  return (
    <Modal visible={!!configId} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlayCenter}>
        <View style={styles.shareBox}>
          <Text style={styles.title}>ویرایش</Text>
          <Text style={styles.label}>نام</Text>
          <TextInput
            style={styles.input} value={name} onChangeText={setName}
            placeholderTextColor={NeonTheme.colors.textMuted}
          />
          {cfg && (
            <Text style={styles.meta}>
              {cfg.protocol.toUpperCase()} • {cfg.address}:{cfg.port}
              {cfg.sni ? `\nSNI: ${cfg.sni}` : ''}
              {cfg.ping !== undefined && cfg.ping !== null ? `\nپینگ: ${cfg.ping < 0 ? 'ناموفق' : cfg.ping + 'ms'}` : ''}
            </Text>
          )}
          <TouchableOpacity style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveText}>ذخیره</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>بستن</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  sheet: {
    backgroundColor: NeonTheme.colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 34, maxHeight: '88%', borderTopWidth: 1, borderColor: NeonTheme.colors.border,
  },
  shareBox: { backgroundColor: NeonTheme.colors.bgCard, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: NeonTheme.colors.border },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: NeonTheme.colors.textMuted, alignSelf: 'center', marginBottom: 12 },
  title: { color: NeonTheme.colors.textPrimary, fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  empty: { color: NeonTheme.colors.textMuted, textAlign: 'center', marginVertical: 24, fontSize: 14 },
  card: { backgroundColor: NeonTheme.colors.bgInput, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: NeonTheme.colors.border },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { color: NeonTheme.colors.textPrimary, fontSize: 15, fontWeight: '700' },
  meta: { color: NeonTheme.colors.textMuted, fontSize: 11, marginTop: 3, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  abtn: { backgroundColor: NeonTheme.colors.bgCardElevated, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: NeonTheme.colors.border },
  abtnActive: { backgroundColor: NeonTheme.colors.cyan, borderColor: NeonTheme.colors.cyan },
  abtnText: { color: NeonTheme.colors.cyan, fontSize: 13, fontWeight: '700' },
  del: { borderColor: NeonTheme.colors.red + '55' },
  refreshAll: { alignSelf: 'center', marginBottom: 12, padding: 8 },
  refreshAllText: { color: NeonTheme.colors.cyan, fontWeight: '700', fontSize: 14 },
  closeBtn: { marginTop: 12, alignItems: 'center', padding: 8 },
  closeText: { color: NeonTheme.colors.textMuted, fontSize: 14 },
  qrWrap: { backgroundColor: '#fff', borderRadius: 16, padding: 14, alignSelf: 'center', marginVertical: 10 },
  rawBox: { maxHeight: 160, backgroundColor: NeonTheme.colors.bgInput, borderRadius: 12, padding: 10, marginVertical: 10 },
  rawText: { color: NeonTheme.colors.textSecondary, fontSize: 11, fontFamily: NeonTheme.typography.fontMono },
  label: { color: NeonTheme.colors.textSecondary, fontSize: 12, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: NeonTheme.colors.bgInput, color: NeonTheme.colors.textPrimary,
    borderRadius: 12, padding: 12, fontSize: 14, borderWidth: 1, borderColor: NeonTheme.colors.border,
  },
  saveBtn: { backgroundColor: NeonTheme.colors.purple, borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 14 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  killRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  switch: { width: 52, height: 30, borderRadius: 15, backgroundColor: NeonTheme.colors.bgInput, borderWidth: 1, borderColor: NeonTheme.colors.border, justifyContent: 'center', paddingHorizontal: 3 },
  switchOn: { backgroundColor: NeonTheme.colors.connected + '44', borderColor: NeonTheme.colors.connected },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: NeonTheme.colors.textMuted },
  knobOn: { backgroundColor: NeonTheme.colors.connected, alignSelf: 'flex-end' },
});
