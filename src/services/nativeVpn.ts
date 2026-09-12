// Typed wrapper around expo-xray-vpn (Android native: VpnService + TUN + Xray).
// Loads lazily so the JS bundle also runs on web / Expo Go without crashing.
import type {
  ExpoXrayVpnConfig,
  ExpoXrayVpnState,
} from 'expo-xray-vpn';

export type NativeVpnState = 'disconnected' | 'preparing' | 'connecting' | 'connected' | 'disconnecting' | 'error';

let mod: any = null;
let loadErr: string | null = null;

export function loadNativeVpn(): any {
  if (mod || loadErr) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-xray-vpn').default;
  } catch (e: any) {
    loadErr = e?.message || String(e);
    mod = null;
  }
  return mod;
}

export function nativeVpnAvailable(): boolean {
  return loadNativeVpn() != null;
}

export function nativeVpnLoadError(): string | null {
  loadNativeVpn();
  return loadErr;
}

export async function requestVpnPermission(): Promise<boolean> {
  const m = loadNativeVpn();
  if (!m) throw new Error('ماژول VPN نیتیو در این بیلد نیست');
  const r = await m.requestPermission();
  return !!r?.granted;
}

export async function startNativeVpn(opts: {
  xrayConfigJson: string;
  profileName: string;
  profileId: string;
  dnsServer: string;
}): Promise<void> {
  const m = loadNativeVpn();
  if (!m) throw new Error('ماژول VPN نیتیو در این بیلد نیست');
  const cfg: ExpoXrayVpnConfig = {
    dnsServer: opts.dnsServer,
    tunAddress: '10.8.0.2',
    tunPrefix: 24,
    mtu: 1500,
    profileId: opts.profileId,
    profileName: opts.profileName,
    routes: [
      { address: '0.0.0.0', prefix: 0 },
      { address: '::', prefix: 0 },
    ],
    xrayConfigJson: opts.xrayConfigJson,
  };
  await m.connect(cfg);
}

export async function stopNativeVpn(): Promise<void> {
  const m = loadNativeVpn();
  if (!m) return;
  await m.disconnect();
}

export function subscribeNativeState(
  cb: (s: { state: NativeVpnState; error?: string }) => void,
): () => void {
  const m = loadNativeVpn();
  if (!m) return () => {};
  const sub = m.addListener('onStateChange', (ev: ExpoXrayVpnState) => {
    cb({ state: ev.state as NativeVpnState, error: ev.error });
  });
  return () => sub.remove();
}

export async function getNativeState(): Promise<{
  state: NativeVpnState;
  error?: string;
} | null> {
  const m = loadNativeVpn();
  if (!m) return null;
  try {
    const s: ExpoXrayVpnState = await m.getState();
    return { state: s.state as NativeVpnState, error: s.error };
  } catch {
    return null;
  }
}
