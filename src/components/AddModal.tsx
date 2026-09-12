import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { useVpn } from '../context/VpnContext';
import { NeonTheme } from '../theme/neonTheme';
import { Proto, buildLink, parseV2rayLink, uid, looksLikeSubUrl, extractLinks, schemeOfLine } from '../services/configParser';

type Tab = 'paste' | 'qr' | 'manual' | 'sub';
type Msg = { type: 'ok' | 'err' | 'info'; text: string } | null;

const SUPPORTED = 'vless / vmess / trojan / ss / hy2';

export const AddModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { addConfigRaw, addManualConfig, addSubscription } = useVpn();
  const [tab, setTab] = useState<Tab>('paste');
  const [paste, setPaste] = useState('');
  const [subUrl, setSubUrl] = useState('');
  const [subName, setSubName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [permission, requestPermission] = useCameraPermissions();
  // manual form
  const [mProto, setMProto] = useState<Proto>('vless');
  const [mName, setMName] = useState('');
  const [mAddr, setMAddr] = useState('');
  const [mPort, setMPort] = useState('443');
  const [mUuid, setMUuid] = useState('');
  const [mSni, setMSni] = useState('');

  const reset = () => {
    setPaste(''); setSubUrl(''); setSubName(''); setBusy(false);
    setMsg(null); setTab('paste');
  };
  const close = () => { reset(); onClose(); };

  const success = (text: string) => {
    setMsg({ type: 'ok', text });
    setTimeout(() => { onClose(); setMsg(null); setPaste(''); setSubUrl(''); setSubName(''); setBusy(false); setTab('paste'); }, 900);
  };

  // auto-read clipboard when sheet opens
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const t = (await Clipboard.getStringAsync()).trim();
        if (!t) return;
        if (looksLikeSubUrl(t)) {
          setTab('sub');
          setSubUrl(t);
          setMsg({ type: 'info', text: 'لینک ساب از کلیپ‌بورد خوانده شد — «دریافت ساب» را بزن' });
        } else if (t.includes('://')) {
          setTab('paste');
          setPaste(t);
          setMsg({ type: 'info', text: 'لینک از کلیپ‌بورد خوانده شد — «ایمپورت» را بزن' });
        }
      } catch { /* clipboard unavailable */ }
    })();
  }, [visible]);

  const doPasteImport = async (text?: string) => {
    // instant feedback first: proves the tap registered
    setMsg({ type: 'info', text: 'در حال ایمپورت...' });
    try {
      const src = (text ?? paste).trim();
      if (!src) { setMsg({ type: 'err', text: 'متنی برای ایمپورت نیست' }); return; }
      // smart extract: works even if text has extra words / breaks / RTL marks
      const { configs: found, urls } = extractLinks(src);
      const lines = found.length > 0 || urls.length > 0
        ? [...found, ...urls]
        : src.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let added = 0;
      let dup = 0;
      const badSchemes = new Set<string>();
      let bad = 0;
      for (const l of lines) {
        if (looksLikeSubUrl(l)) {
          try {
            const n = await addSubscription(l, 'Subscription');
            added += n;
          } catch (e: any) {
            setMsg({ type: 'err', text: `دریافت ساب ناموفق: ${e?.message || 'خطای شبکه'}` });
            return;
          }
          continue;
        }
        const r = addConfigRaw(l);
        if (r === 'added') added++;
        else if (r === 'duplicate') dup++;
        else {
          bad++;
          const s = schemeOfLine(l);
          if (s) badSchemes.add(s);
        }
      }
      if (added > 0) {
        success(`${added} کانفیگ اضافه شد${dup > 0 ? ` (${dup} تکراری رد شد)` : ''}`);
      } else if (dup > 0 && bad === 0) {
        setMsg({ type: 'info', text: 'این کانفیگ قبلاً اضافه شده' });
      } else {
        const extra = badSchemes.size > 0
          ? ` — «${[...badSchemes].join('، ')}» پشتیبانی نمی‌شود. فقط: ${SUPPORTED}`
          : ` — لینک باید با یکی از این‌ها شروع شود: ${SUPPORTED}`;
        setMsg({ type: 'err', text: `لینک معتبر نیست${extra}` });
      }
    } catch (e: any) {
      setMsg({ type: 'err', text: `خطای غیرمنتظره: ${e?.message || String(e)}` });
    }
  };

  // ONE-TAP: read clipboard and import immediately
  const doAutoClipboard = async () => {
    setMsg({ type: 'info', text: 'در حال خواندن کلیپ‌بورد...' });
    setBusy(true);
    try {
      let t = '';
      try {
        t = (await Clipboard.getStringAsync()).trim();
      } catch (e: any) {
        setMsg({ type: 'err', text: `کلیپ‌بورد در دسترس نیست: ${e?.message || ''}` });
        return;
      }
      if (!t) { setMsg({ type: 'err', text: 'کلیپ‌بورد خالی است — اول لینک را کپی کن' }); return; }
      if (looksLikeSubUrl(t)) {
        try {
          const n = await addSubscription(t, 'Subscription');
          success(`${n} کانفیگ از ساب اضافه شد`);
        } catch (e: any) {
          setMsg({ type: 'err', text: `دریافت ساب ناموفق: ${e?.message || 'خطای شبکه'}` });
        }
        return;
      }
      await doPasteImport(t);
    } finally {
      setBusy(false);
    }
  };

  const doAddSub = async () => {
    setMsg({ type: 'info', text: 'در حال دریافت ساب...' });
    if (!subUrl.trim()) { setMsg({ type: 'err', text: 'لینک ساب را وارد کن' }); return; }
    setBusy(true);
    try {
      const n = await addSubscription(subUrl.trim(), subName.trim() || 'Subscription');
      success(`${n} کانفیگ از ساب اضافه شد`);
    } catch (e: any) {
      setMsg({ type: 'err', text: `دریافت ساب ناموفق: ${e?.message || 'خطای شبکه'}` });
    } finally {
      setBusy(false);
    }
  };

  const doManualAdd = () => {
    if (!mAddr.trim() || !mUuid.trim()) { setMsg({ type: 'err', text: 'آدرس سرور و UUID/پسورد لازم است' }); return; }
    const port = parseInt(mPort, 10) || 443;
    const name = mName.trim() || `${mAddr.trim()}:${port}`;
    const link = buildLink({
      protocol: mProto, address: mAddr.trim(), port, uuid: mUuid.trim(),
      name, sni: mSni.trim() || mAddr.trim(),
    });
    const cfg = parseV2rayLink(link);
    if (!cfg) { setMsg({ type: 'err', text: 'ساخت کانفیگ ناموفق بود' }); return; }
    cfg.name = name;
    cfg.id = uid();
    addManualConfig(cfg);
    success('کانفیگ اضافه شد');
  };

  const onQrScanned = ({ data }: { data: string }) => {
    if (busy) return;
    setBusy(true);
    const t = data.trim();
    if (t.startsWith('http')) {
      addSubscription(t, 'Scanned Sub').then(
        n => { success(`${n} کانفیگ اضافه شد`); },
        (e: any) => { setBusy(false); setMsg({ type: 'err', text: `QR معتبر نیست: ${e?.message || ''}` }); },
      );
    } else {
      const r = addConfigRaw(t);
      if (r === 'added') success('کانفیگ اضافه شد');
      else if (r === 'duplicate') { setBusy(false); setMsg({ type: 'info', text: 'این کانفیگ قبلاً اضافه شده' }); }
      else { setBusy(false); setMsg({ type: 'err', text: `QR معتبر نیست — فقط: ${SUPPORTED}` }); }
    }
  };

  if (!visible) return null;

  // NOTE: plain overlay view (not RN Modal) — Modal sheets can render
  // behind the Android nav bar with dead touches; this always receives taps.
  return (
    <View style={styles.root}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>افزودن کانفیگ</Text>

        {/* one-tap auto import */}
        <TouchableOpacity
          style={styles.autoBtn}
          onPress={doAutoClipboard}
          disabled={busy}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.autoText}>📋 ایمپورت خودکار از کلیپ‌بورد</Text>}
        </TouchableOpacity>

        <View style={styles.tabs}>
          {([['paste', '📋 متن'], ['qr', '📷 QR'], ['manual', '✍️ دستی'], ['sub', '🔗 ساب']] as [Tab, string][]).map(([k, label]) => (
            <TouchableOpacity
              key={k}
              style={[styles.tab, tab === k && styles.tabActive]}
              onPress={() => { setTab(k); setMsg(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {msg && (
          <View style={[styles.msgBox, msg.type === 'ok' ? styles.msgOk : msg.type === 'err' ? styles.msgErr : styles.msgInfo]}>
            <Text style={styles.msgText}>{msg.text}</Text>
          </View>
        )}

        <ScrollView keyboardShouldPersistTaps="handled" style={styles.tabScroll} contentContainerStyle={{ paddingBottom: 4 }}>
          {tab === 'paste' && (
            <View>
              <TextInput
                style={styles.input} multiline numberOfLines={4} placeholder="vless://... (هر خط یک کانفیگ)"
                placeholderTextColor={NeonTheme.colors.textMuted} value={paste} onChangeText={setPaste}
                autoCapitalize="none" autoCorrect={false}
              />
              <TouchableOpacity style={styles.btnFull} onPress={() => doPasteImport()} activeOpacity={0.7}>
                <Text style={styles.btnText}>ایمپورت</Text>
              </TouchableOpacity>
            </View>
          )}

          {tab === 'qr' && (
            <View style={styles.qrBox}>
              {!permission?.granted ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.hint}>برای اسکن QR دسترسی دوربین لازم است</Text>
                  <TouchableOpacity style={styles.btnFull} onPress={requestPermission} activeOpacity={0.7}>
                    <Text style={styles.btnText}>دادن دسترسی</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={busy ? undefined : onQrScanned}
                />
              )}
              {busy && <ActivityIndicator color={NeonTheme.colors.cyan} style={{ marginTop: 10 }} />}
            </View>
          )}

          {tab === 'manual' && (
            <View>
              <View style={styles.protoRow}>
                {(['vless', 'vmess', 'trojan', 'ss'] as Proto[]).map(p => (
                  <TouchableOpacity key={p} style={[styles.proto, mProto === p && styles.protoActive]} onPress={() => setMProto(p)} activeOpacity={0.7}>
                    <Text style={[styles.protoText, mProto === p && styles.protoTextActive]}>{p.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {[
                ['نام (دلخواه)', mName, setMName, 'My Config'],
                ['آدرس سرور', mAddr, setMAddr, 'example.com'],
                ['پورت', mPort, setMPort, '443'],
                ['UUID / Password', mUuid, setMUuid, 'uuid...'],
                ['SNI (دلخواه)', mSni, setMSni, 'example.com'],
              ].map(([label, val, set, ph]: any) => (
                <View key={label}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input} value={val} onChangeText={set} placeholder={ph}
                    placeholderTextColor={NeonTheme.colors.textMuted}
                    autoCapitalize="none" autoCorrect={false}
                    keyboardType={label === 'پورت' ? 'numeric' : 'default'}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.btnFull} onPress={doManualAdd} activeOpacity={0.7}>
                <Text style={styles.btnText}>افزودن</Text>
              </TouchableOpacity>
            </View>
          )}

          {tab === 'sub' && (
            <View>
              <Text style={styles.label}>لینک سابسکریپشن</Text>
              <TextInput
                style={styles.input} value={subUrl} onChangeText={setSubUrl}
                placeholder="https://..." placeholderTextColor={NeonTheme.colors.textMuted}
                autoCapitalize="none" autoCorrect={false}
              />
              <Text style={styles.label}>نام (دلخواه)</Text>
              <TextInput
                style={styles.input} value={subName} onChangeText={setSubName}
                placeholder="My Sub" placeholderTextColor={NeonTheme.colors.textMuted}
              />
              <TouchableOpacity style={styles.btnFull} onPress={doAddSub} disabled={busy} activeOpacity={0.7}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>دریافت ساب</Text>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity style={styles.closeBtn} onPress={close} activeOpacity={0.7}>
          <Text style={styles.closeText}>بستن</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 50,
    elevation: 50,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    position: 'relative',
    backgroundColor: NeonTheme.colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 34, maxHeight: '88%', borderTopWidth: 1, borderColor: NeonTheme.colors.border,
  },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: NeonTheme.colors.textMuted, alignSelf: 'center', marginBottom: 12 },
  title: { color: NeonTheme.colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  autoBtn: { backgroundColor: NeonTheme.colors.emerald, borderRadius: 14, padding: 15, alignItems: 'center', marginBottom: 12 },
  autoText: { color: '#06281d', fontWeight: '800', fontSize: 15 },
  tabs: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: NeonTheme.colors.bgInput, alignItems: 'center' },
  tabActive: { backgroundColor: NeonTheme.colors.purple },
  tabText: { color: NeonTheme.colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  msgBox: { borderRadius: 12, padding: 11, marginBottom: 12, borderWidth: 1 },
  msgOk: { backgroundColor: 'rgba(6,255,165,0.12)', borderColor: NeonTheme.colors.connected },
  msgErr: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: NeonTheme.colors.red },
  msgInfo: { backgroundColor: 'rgba(0,242,254,0.10)', borderColor: NeonTheme.colors.cyan },
  msgText: { color: NeonTheme.colors.textPrimary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  tabScroll: { maxHeight: 400 },
  label: { color: NeonTheme.colors.textSecondary, fontSize: 12, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: NeonTheme.colors.bgInput, color: NeonTheme.colors.textPrimary,
    borderRadius: 12, padding: 12, fontSize: 14, borderWidth: 1, borderColor: NeonTheme.colors.border,
    textAlign: 'left',
  },
  hint: { color: NeonTheme.colors.textSecondary, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btnFull: { backgroundColor: NeonTheme.colors.purple, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  closeBtn: { marginTop: 12, alignItems: 'center', padding: 8 },
  closeText: { color: NeonTheme.colors.textMuted, fontSize: 14 },
  qrBox: { alignItems: 'center' },
  camera: { width: '100%', height: 300, borderRadius: 16, overflow: 'hidden' },
  protoRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  proto: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: NeonTheme.colors.bgInput, alignItems: 'center' },
  protoActive: { backgroundColor: NeonTheme.colors.cyan },
  protoText: { color: NeonTheme.colors.textSecondary, fontSize: 12, fontWeight: '700' },
  protoTextActive: { color: '#000' },
});
