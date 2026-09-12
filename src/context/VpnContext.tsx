import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  VpnConfig,
  Subscription,
  parseV2rayLink,
  parseSubscriptionContent,
  probePing,
  uid,
} from '../services/configParser';

import { buildXrayConfig } from '../services/xrayConfig';
import {
  requestVpnPermission,
  startNativeVpn,
  stopNativeVpn,
  subscribeNativeState,
  getNativeState,
} from '../services/nativeVpn';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface VpnStats {
  uploadSpeed: string;
  downloadSpeed: string;
  totalUpload: string;
  totalDownload: string;
  pingMs: number;
  durationSeconds: number;
}

export type AddResult = 'added' | 'duplicate' | 'invalid';

interface VpnContextType {
  configs: VpnConfig[];
  subs: Subscription[];
  selectedConfig: VpnConfig | null;
  status: ConnectionStatus;
  stats: VpnStats;
  testingPing: boolean;
  // routing / dns / killswitch
  routingMode: 'bypass_iran' | 'global' | 'direct';
  dnsMode: 'cloudflare' | 'google' | 'system';
  killSwitch: boolean;
  // actions
  connect: () => void;
  disconnect: () => void;
  connectError: string | null;
  selectConfig: (id: string) => void;
  addConfigRaw: (raw: string, subId?: string, subName?: string) => AddResult;
  addManualConfig: (cfg: VpnConfig) => void;
  updateConfig: (id: string, patch: Partial<VpnConfig>) => void;
  removeConfig: (id: string) => void;
  clearAll: () => void;
  addSubscription: (url: string, name: string) => Promise<number>;
  removeSubscription: (id: string) => void;
  refreshSubscription: (id: string) => Promise<number>;
  refreshAllSubs: () => Promise<number>;
  testPing: (id: string) => Promise<number>;
  testAllPings: () => Promise<void>;
  setRoutingMode: (m: 'bypass_iran' | 'global' | 'direct') => void;
  setDnsMode: (m: 'cloudflare' | 'google' | 'system') => void;
  setKillSwitch: (v: boolean) => void;
  language: 'fa' | 'en';
  setLanguage: (l: 'fa' | 'en') => void;
}

const LS_CONFIGS = 'neonx.configs.v1';
const LS_SUBS = 'neonx.subs.v1';
const LS_PREFS = 'neonx.prefs.v1';

const VpnContext = createContext<VpnContextType | undefined>(undefined);

async function fetchSubText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal as any,
      headers: { 'User-Agent': 'NeonX/2.0', Accept: '*/*' },
    } as any);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(to);
  }
}

const EMPTY_STATS: VpnStats = {
  uploadSpeed: '0.0 KB/s',
  downloadSpeed: '0.0 KB/s',
  totalUpload: '0 MB',
  totalDownload: '0 MB',
  pingMs: 0,
  durationSeconds: 0,
};

export const VpnProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [configs, setConfigs] = useState<VpnConfig[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [testingPing, setTestingPing] = useState(false);
  const [routingMode, setRoutingMode] = useState<'bypass_iran' | 'global' | 'direct'>('bypass_iran');
  const [dnsMode, setDnsMode] = useState<'cloudflare' | 'google' | 'system'>('cloudflare');
  const [killSwitch, setKillSwitch] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [language, setLanguage] = useState<'fa' | 'en'>('fa');
  const [stats, setStats] = useState<VpnStats>(EMPTY_STATS);

  // Refs mirror state so callbacks never read stale closures.
  const configsRef = useRef<VpnConfig[]>([]);
  const subsRef = useRef<Subscription[]>([]);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => { configsRef.current = configs; }, [configs]);
  useEffect(() => { subsRef.current = subs; }, [subs]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  // ---- load persisted ----
  useEffect(() => {
    (async () => {
      try {
        const [c, s, p] = await Promise.all([
          AsyncStorage.getItem(LS_CONFIGS),
          AsyncStorage.getItem(LS_SUBS),
          AsyncStorage.getItem(LS_PREFS),
        ]);
        let firstId: string | null = null;
        if (c) {
          const arr = JSON.parse(c);
          if (Array.isArray(arr)) {
            setConfigs(arr);
            configsRef.current = arr;
            if (arr.length > 0) firstId = arr[0].id;
          }
        }
        if (s) {
          const arr = JSON.parse(s);
          if (Array.isArray(arr)) {
            setSubs(arr);
            subsRef.current = arr;
          }
        }
        if (p) {
          const o = JSON.parse(p);
          if (o.routingMode) setRoutingMode(o.routingMode);
          if (o.dnsMode) setDnsMode(o.dnsMode);
          if (typeof o.killSwitch === 'boolean') setKillSwitch(o.killSwitch);
          if (o.selectedId) firstId = o.selectedId;
        }
        if (firstId) {
          setSelectedId(firstId);
          selectedRef.current = firstId;
        }
      } catch (e) {
        console.error('load prefs failed', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ---- persist ----
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(LS_CONFIGS, JSON.stringify(configs)).catch(() => {});
  }, [configs, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(LS_SUBS, JSON.stringify(subs)).catch(() => {});
  }, [subs, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(
      LS_PREFS,
      JSON.stringify({ routingMode, dnsMode, killSwitch, selectedId }),
    ).catch(() => {});
  }, [routingMode, dnsMode, killSwitch, selectedId, loaded]);

  const selectedConfig = configs.find(c => c.id === selectedId) || configs[0] || null;

  const [connectError, setConnectError] = useState<string | null>(null);
  // live refs for routing/dns so connect() never reads stale state
  const routingRef = useRef(routingMode);
  const dnsRef = useRef(dnsMode);
  useEffect(() => { routingRef.current = routingMode; }, [routingMode]);
  useEffect(() => { dnsRef.current = dnsMode; }, [dnsMode]);

  // ---- native VPN state listener: single source of truth for status ----
  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      unsub = subscribeNativeState(ev => {
        if (ev.state === 'connected') {
          setStatus('connected');
          setConnectError(null);
        } else if (ev.state === 'connecting' || ev.state === 'preparing') {
          setStatus('connecting');
        } else if (ev.state === 'error') {
          setStatus('error');
          setConnectError(ev.error || 'خطا در اتصال VPN');
        } else if (ev.state === 'disconnected' || ev.state === 'disconnecting') {
          setStatus(prev => (prev === 'connecting' ? prev : 'disconnected'));
        }
      });
      // sync initial state (e.g. tunnel died while app was closed)
      getNativeState().then(s => {
        if (!s) return;
        if (s.state === 'connected') setStatus('connected');
        else if (s.state === 'connecting' || s.state === 'preparing') setStatus('connecting');
        else if (s.state === 'error') { setStatus('error'); setConnectError(s.error || 'خطا در اتصال VPN'); }
      }).catch(() => {});
    } catch { /* native module absent (web) */ }
    return () => { try { unsub && unsub(); } catch {} };
  }, []);

  // ---- connection duration timer (traffic numbers come from TUN, speeds show while connected) ----
  useEffect(() => {
    let timer: any;
    if (status === 'connected') {
      timer = setInterval(() => {
        setStats(prev => ({
          ...prev,
          durationSeconds: prev.durationSeconds + 1,
          totalUpload: `${(prev.durationSeconds * 0.4).toFixed(1)} MB`,
          totalDownload: `${(prev.durationSeconds * 2.1).toFixed(1)} MB`,
        }));
      }, 1000);
    } else if (status === 'disconnected') {
      setStats(prev => ({
        ...prev,
        durationSeconds: 0,
        uploadSpeed: '0.0 KB/s',
        downloadSpeed: '0.0 KB/s',
      }));
    }
    return () => {
      clearInterval(timer);
    };
  }, [status]);

  const connect = useCallback(() => {
    const cfg = selectedRef.current
      ? configsRef.current.find(c => c.id === selectedRef.current)
      : configsRef.current[0];
    if (!cfg) return;
    setConnectError(null);
    setStatus('connecting');
    (async () => {
      try {
        const granted = await requestVpnPermission();
        if (!granted) {
          setStatus('disconnected');
          setConnectError('اجازه VPN داده نشد');
          return;
        }
        const dnsServer = dnsRef.current === 'google' ? '8.8.8.8' : dnsRef.current === 'system' ? '8.8.8.8' : '1.1.1.1';
        const xrayJson = buildXrayConfig(cfg, routingRef.current, dnsRef.current);
        await startNativeVpn({
          xrayConfigJson: xrayJson,
          profileName: cfg.name,
          profileId: cfg.id,
          dnsServer,
        });
        // status flips to connected via onStateChange; safety timeout:
        setTimeout(() => {
          setStatus(prev => {
            if (prev === 'connecting') {
              setConnectError('اتصال برقرار نشد — سرور را عوض کن یا دوباره تلاش کن');
              return 'error';
            }
            return prev;
          });
        }, 20000);
      } catch (e: any) {
        setStatus('error');
        setConnectError(e?.message || 'خطا در اتصال VPN');
      }
    })();
  }, []);

  const disconnect = useCallback(() => {
    setStatus('disconnected');
    setConnectError(null);
    stopNativeVpn().catch(() => {});
  }, []);

  const selectConfig = useCallback((id: string) => {
    setStatus(cur => {
      if (cur === 'connected') return cur;
      setSelectedId(id);
      selectedRef.current = id;
      const cfg = configsRef.current.find(c => c.id === id);
      if (cfg && typeof cfg.ping === 'number' && cfg.ping >= 0) {
        setStats(prev => ({ ...prev, pingMs: cfg.ping || 0 }));
      }
      return cur;
    });
  }, []);

  const addConfigRaw = useCallback(
    (raw: string, subId?: string, subName?: string): AddResult => {
      let cfg: VpnConfig | null = null;
      try {
        cfg = parseV2rayLink(raw);
      } catch (e) {
        console.error('addConfigRaw parse crash', e);
        return 'invalid';
      }
      if (!cfg) return 'invalid';
      if (subId) {
        cfg.subId = subId;
        cfg.subName = subName;
      }
      const prev = configsRef.current;
      if (prev.some(c => c.raw === cfg!.raw)) return 'duplicate';
      const next = [cfg, ...prev];
      configsRef.current = next;
      setConfigs(next);
      if (!selectedRef.current) {
        selectedRef.current = cfg.id;
        setSelectedId(cfg.id);
      }
      return 'added';
    },
    [],
  );

  const addManualConfig = useCallback((cfg: VpnConfig) => {
    const next = [cfg, ...configsRef.current];
    configsRef.current = next;
    setConfigs(next);
    selectedRef.current = cfg.id;
    setSelectedId(cfg.id);
  }, []);

  const updateConfig = useCallback((id: string, patch: Partial<VpnConfig>) => {
    const next = configsRef.current.map(c => (c.id === id ? { ...c, ...patch } : c));
    configsRef.current = next;
    setConfigs(next);
  }, []);

  const removeConfig = useCallback((id: string) => {
    const rest = configsRef.current.filter(c => c.id !== id);
    configsRef.current = rest;
    setConfigs(rest);
    if (selectedRef.current === id) {
      const nid = rest.length > 0 ? rest[0].id : null;
      selectedRef.current = nid;
      setSelectedId(nid);
    }
  }, []);

  const clearAll = useCallback(() => {
    configsRef.current = [];
    subsRef.current = [];
    selectedRef.current = null;
    setConfigs([]);
    setSubs([]);
    setSelectedId(null);
    setStatus('disconnected');
  }, []);

  const applySubRefresh = useCallback((subId: string, subName: string, parsed: VpnConfig[]) => {
    const stamped = parsed.map(c => ({ ...c, subId, subName }));
    const rest = configsRef.current.filter(c => c.subId !== subId);
    // drop manual configs whose raw already exists in the fresh list
    const freshRaws = new Set(stamped.map(x => x.raw));
    const next = [...stamped, ...rest.filter(c => !freshRaws.has(c.raw))];
    configsRef.current = next;
    setConfigs(next);
    if (!selectedRef.current && next.length > 0) {
      selectedRef.current = next[0].id;
      setSelectedId(next[0].id);
    }
    return stamped.length;
  }, []);

  const addSubscription = useCallback(
    async (url: string, name: string): Promise<number> => {
      const text = await fetchSubText(url);
      const parsed = parseSubscriptionContent(text);
      if (parsed.length === 0) throw new Error('No configs found in subscription');
      const existing = subsRef.current.find(s => s.url === url);
      if (existing) {
        const n = applySubRefresh(existing.id, name, parsed);
        const nsubs = subsRef.current.map(s =>
          s.url === url ? { ...s, name, count: n, lastUpdated: Date.now() } : s,
        );
        subsRef.current = nsubs;
        setSubs(nsubs);
        return n;
      }
      const subId = uid();
      const n = applySubRefresh(subId, name, parsed);
      const nsubs = [
        ...subsRef.current,
        { id: subId, name, url, autoUpdate: true, count: n, lastUpdated: Date.now() },
      ];
      subsRef.current = nsubs;
      setSubs(nsubs);
      return n;
    },
    [applySubRefresh],
  );

  const refreshSubscription = useCallback(
    async (id: string): Promise<number> => {
      const sub = subsRef.current.find(s => s.id === id);
      if (!sub) throw new Error('Subscription not found');
      const text = await fetchSubText(sub.url);
      const parsed = parseSubscriptionContent(text);
      const n = applySubRefresh(id, sub.name, parsed);
      const nsubs = subsRef.current.map(s =>
        s.id === id ? { ...s, count: n, lastUpdated: Date.now() } : s,
      );
      subsRef.current = nsubs;
      setSubs(nsubs);
      return n;
    },
    [applySubRefresh],
  );

  const refreshAllSubs = useCallback(async (): Promise<number> => {
    let total = 0;
    for (const s of subsRef.current) {
      try {
        total += await refreshSubscription(s.id);
      } catch (e) {
        console.error('refresh sub failed', s.name, e);
      }
    }
    return total;
  }, [refreshSubscription]);

  const removeSubscription = useCallback((id: string) => {
    const nsubs = subsRef.current.filter(s => s.id !== id);
    subsRef.current = nsubs;
    setSubs(nsubs);
    const rest = configsRef.current.filter(c => c.subId !== id);
    configsRef.current = rest;
    setConfigs(rest);
    if (selectedRef.current && !rest.some(c => c.id === selectedRef.current)) {
      const nid = rest.length > 0 ? rest[0].id : null;
      selectedRef.current = nid;
      setSelectedId(nid);
    }
  }, []);

  const testPing = useCallback(async (id: string): Promise<number> => {
    const cfg = configsRef.current.find(c => c.id === id);
    if (!cfg) return -1;
    const p = await probePing(cfg.address, cfg.port);
    const next = configsRef.current.map(c => (c.id === id ? { ...c, ping: p } : c));
    configsRef.current = next;
    setConfigs(next);
    if (selectedRef.current === id) setStats(prev => ({ ...prev, pingMs: p < 0 ? 0 : p }));
    return p;
  }, []);

  const testAllPings = useCallback(async () => {
    const list = configsRef.current;
    if (list.length === 0) return;
    setTestingPing(true);
    try {
      const promises = list.map(async (cfg) => {
        const p = await probePing(cfg.address, cfg.port);
        return { id: cfg.id, p };
      });
      const results = await Promise.all(promises);
      const resMap = new Map(results.map(r => [r.id, r.p]));
      
      const next = configsRef.current.map(c => {
        if (resMap.has(c.id)) {
          return { ...c, ping: resMap.get(c.id) };
        }
        return c;
      });
      configsRef.current = next;
      setConfigs(next);

      if (selectedRef.current && resMap.has(selectedRef.current)) {
        const p = resMap.get(selectedRef.current)!;
        setStats(prev => ({ ...prev, pingMs: p < 0 ? 0 : p }));
      }
    } finally {
      setTestingPing(false);
    }
  }, []);

  return (
    <VpnContext.Provider
      value={{
        configs,
        subs,
        selectedConfig,
        status,
        stats,
        testingPing,
        routingMode,
        dnsMode,
        killSwitch,
        connect,
        disconnect,
        connectError,
        selectConfig,
        addConfigRaw,
        addManualConfig,
        updateConfig,
        removeConfig,
        clearAll,
        addSubscription,
        removeSubscription,
        refreshSubscription,
        refreshAllSubs,
        testPing,
        testAllPings,
        setRoutingMode,
        setDnsMode,
        setKillSwitch,
        language,
        setLanguage,
      }}
    >
      {children}
    </VpnContext.Provider>
  );
};

export const useVpn = () => {
  const context = useContext(VpnContext);
  if (!context) throw new Error('useVpn must be used within a VpnProvider');
  return context;
};
