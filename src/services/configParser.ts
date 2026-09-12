export type Proto = 'vless' | 'vmess' | 'trojan' | 'ss' | 'hysteria2' | 'wireguard' | 'unknown';

export interface VpnConfig {
  id: string;
  name: string;
  protocol: Proto;
  address: string;
  port: number;
  uuid: string;
  security?: string;
  sni?: string;
  flow?: string;
  alpn?: string;
  fp?: string;
  allowInsecure?: boolean;
  pbk?: string;
  sid?: string;
  spiderX?: string;
  net?: string;
  path?: string;
  host?: string;
  raw: string;
  ping?: number; // ms, -1 = timeout
  subId?: string;
  subName?: string;
}

export interface Subscription {
  id: string;
  name: string;
  url: string;
  autoUpdate: boolean;
  count: number;
  lastUpdated: number;
}

export const uid = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36).slice(-4);

const PROTO_COLORS: Record<Proto, string> = {
  vless: '#8b5cf6',
  vmess: '#00f2fe',
  trojan: '#ec4899',
  ss: '#06ffa5',
  hysteria2: '#f59e0b',
  wireguard: '#60a5fa',
  unknown: '#64748b',
};

export const protoColor = (p: Proto) => PROTO_COLORS[p] || PROTO_COLORS.unknown;
export const protoLabel = (p: Proto) =>
  p === 'ss' ? 'SS' : p === 'hysteria2' ? 'HY2' : p === 'unknown' ? '?' : p.toUpperCase();

// ---------- pure-JS base64 (no atob/btoa/TextDecoder: missing on Hermes) ----------
const B64CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64ToBytes(s: string): Uint8Array {
  let t = s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  while (t.length % 4) t += '=';
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '=') break;
    const v = B64CHARS.indexOf(ch);
    if (v < 0) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

function utf8Decode(bytes: Uint8Array): string {
  let s = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i];
    if (b0 < 0x80) {
      s += String.fromCharCode(b0);
      i++;
    } else if ((b0 & 0xe0) === 0xc0) {
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      s += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
      i += 2;
    } else if ((b0 & 0xf0) === 0xe0) {
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      s += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
      i += 3;
    } else {
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      const b3 = i + 3 < bytes.length ? bytes[i + 3] : 0;
      let cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      cp -= 0x10000;
      s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      i += 4;
    }
  }
  return s;
}

function utf8Encode(s: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let cp = s.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < s.length) {
      const lo = s.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000)
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
  }
  return bytes;
}

function b64decode(s: string): string {
  return utf8Decode(b64ToBytes(s));
}

function b64encodeUtf8(s: string): string {
  const bytes = utf8Encode(s);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : -1;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : -1;
    out += B64CHARS[b0 >> 2];
    out += B64CHARS[((b0 & 3) << 4) | (b1 >= 0 ? b1 >> 4 : 0)];
    out += b1 >= 0 ? B64CHARS[((b1 & 15) << 2) | (b2 >= 0 ? b2 >> 6 : 0)] : '=';
    out += b2 >= 0 ? B64CHARS[b2 & 63] : '=';
  }
  return out;
}

/** Strip invisible/RTL chars that sneak in when copying from Telegram etc. */
export function sanitizeLink(s: string): string {
  return s
    .replace(/[\u200e\u200f\u200c\u200b\u00a0\u061c\ufeff\u202a\u202b\u202c\u202d\u202e]/g, '')
    .trim();
}

export function looksLikeSubUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

const CONFIG_SCHEMES = ['vless', 'vmess', 'trojan', 'ss', 'hysteria2', 'hy2', 'wireguard'];

/** Pull config links + http(s) urls out of messy text (extra words, RTL marks, line breaks). */
export function extractLinks(text: string): { configs: string[]; urls: string[] } {
  const clean = sanitizeLink(text);
  const configs: string[] = [];
  const urls: string[] = [];
  const seen = new Set<string>();
  const re = /((?:vless|vmess|trojan|ss|hysteria2|hy2|wireguard):\/\/[^\s"'<>`]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    const link = m[1].replace(/[.,;)\]]+$/, '');
    if (!seen.has(link)) {
      seen.add(link);
      configs.push(link);
    }
  }
  const ru = /(https?:\/\/[^\s"'<>`]+)/gi;
  while ((m = ru.exec(clean)) !== null) {
    const u = m[1].replace(/[.,;)\]]+$/, '');
    // skip if it's part of an already-found config link
    if (!configs.some(c => c.includes(u)) && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }
  return { configs, urls };
}

export function schemeOfLine(line: string): string {
  const i = line.indexOf('://');
  if (i <= 0 || i > 20) return '';
  return line.slice(0, i).toLowerCase();
}

function splitName(link: string): [string, string] {
  const i = link.indexOf('#');
  if (i < 0) return [link, ''];
  try {
    return [link.slice(0, i), decodeURIComponent(link.slice(i + 1))];
  } catch {
    return [link.slice(0, i), link.slice(i + 1)];
  }
}

function parseQuery(q: string): URLSearchParams {
  try {
    return new URLSearchParams(q);
  } catch {
    return new URLSearchParams();
  }
}

function parseVless(link: string): VpnConfig | null {
  const [head, frag] = splitName(link);
  const rest = head.substring(8);
  const qi = rest.indexOf('?');
  const left = qi >= 0 ? rest.slice(0, qi) : rest;
  const query = qi >= 0 ? rest.slice(qi + 1) : '';
  const ai = left.lastIndexOf('@');
  if (ai < 0) return null;
  const user = left.slice(0, ai);
  const addrPort = left.slice(ai + 1);
  const ci = addrPort.lastIndexOf(':');
  if (ci < 0) return null;
  const address = addrPort.slice(0, ci).replace(/^\[|\]$/g, '');
  const port = parseInt(addrPort.slice(ci + 1), 10) || 443;
  const qp = parseQuery(query);
  const truthy = (v: string | null) => v === '1' || v === 'true';
  return {
    id: uid(),
    name: frag || `${address}:${port} (VLESS)`,
    protocol: 'vless',
    address,
    port,
    uuid: user,
    security: qp.get('security') || 'none',
    sni: (() => { try { return decodeURIComponent(qp.get('sni') || qp.get('serverName') || ''); } catch { return qp.get('sni') || ''; } })(),
    flow: qp.get('flow') || '',
    alpn: (() => { try { return decodeURIComponent(qp.get('alpn') || ''); } catch { return qp.get('alpn') || ''; } })() || undefined,
    fp: qp.get('fp') || undefined,
    allowInsecure: truthy(qp.get('allowInsecure')) || truthy(qp.get('insecure')),
    pbk: qp.get('pbk') || undefined,
    sid: qp.get('sid') || undefined,
    spiderX: (() => { try { return decodeURIComponent(qp.get('spiderX') || ''); } catch { return qp.get('spiderX') || ''; } })() || undefined,
    net: qp.get('type') || 'tcp',
    path: qp.get('path') || '',
    host: qp.get('host') || '',
    raw: link,
  };
}

function parseTrojan(link: string): VpnConfig | null {
  const [head, frag] = splitName(link);
  const rest = head.substring(9);
  const qi = rest.indexOf('?');
  const left = qi >= 0 ? rest.slice(0, qi) : rest;
  const query = qi >= 0 ? rest.slice(qi + 1) : '';
  const ai = left.lastIndexOf('@');
  if (ai < 0) return null;
  const pass = left.slice(0, ai);
  const addrPort = left.slice(ai + 1);
  const ci = addrPort.lastIndexOf(':');
  if (ci < 0) return null;
  const address = addrPort.slice(0, ci).replace(/^\[|\]$/g, '');
  const port = parseInt(addrPort.slice(ci + 1), 10) || 443;
  const qp = parseQuery(query);
  return {
    id: uid(),
    name: frag || `${address}:${port} (Trojan)`,
    protocol: 'trojan',
    address,
    port,
    uuid: pass,
    security: qp.get('security') || 'tls',
    sni: qp.get('sni') || '',
    net: qp.get('type') || 'tcp',
    path: qp.get('path') || '',
    host: qp.get('host') || '',
    raw: link,
  };
}

function parseVmess(link: string): VpnConfig | null {
  const body = link.substring(8).trim();
  try {
    const obj = JSON.parse(b64decode(body));
    return {
      id: uid(),
      name: obj.ps || `${obj.add}:${obj.port} (VMess)`,
      protocol: 'vmess',
      address: obj.add || '',
      port: parseInt(obj.port, 10) || 443,
      uuid: obj.id || '',
      security: obj.net || 'tcp',
      sni: obj.sni || obj.host || '',
      net: obj.net || 'tcp',
      path: obj.path || '',
      host: obj.host || '',
      raw: link,
    };
  } catch {
    return null;
  }
}

function parseSS(link: string): VpnConfig | null {
  const [head, frag] = splitName(link);
  let rest = head.substring(5);
  // ss://method:pass@host:port  OR  ss://base64(method:pass@host:port)  OR ss://base64(method:pass)@host:port
  try {
    if (!rest.includes('@')) {
      rest = b64decode(rest);
    } else {
      const ai = rest.lastIndexOf('@');
      const first = rest.slice(0, ai);
      if (!first.includes(':')) {
        rest = b64decode(first) + rest.slice(ai);
      }
    }
    const ai = rest.lastIndexOf('@');
    if (ai < 0) return null;
    const creds = rest.slice(0, ai);
    const hostPort = rest.slice(ai + 1).split('?')[0].split('/')[0].split('#')[0];
    const ci = hostPort.lastIndexOf(':');
    if (ci < 0) return null;
    const credParts = creds.split(':');
    const host = hostPort.slice(0, ci).replace(/^\[|\]$/g, '');
    const sPort = parseInt(hostPort.slice(ci + 1), 10) || 8388;
    return {
      id: uid(),
      name: frag || `${host}:${sPort} (SS)`,
      protocol: 'ss',
      address: host,
      port: sPort,
      uuid: creds,
      security: credParts[0] || '',
      raw: link,
    };
  } catch {
    return null;
  }
}

function parseHysteria2(link: string): VpnConfig | null {
  const [head, frag] = splitName(link);
  const low = link.toLowerCase();
  const scheme = low.startsWith('hysteria2://') ? 13 : 11;
  const rest = head.substring(scheme);
  const qi = rest.indexOf('?');
  const left = qi >= 0 ? rest.slice(0, qi) : rest;
  const query = qi >= 0 ? rest.slice(qi + 1) : '';
  const ai = left.lastIndexOf('@');
  if (ai < 0) return null;
  const pass = left.slice(0, ai);
  const addrPort = left.slice(ai + 1);
  const ci = addrPort.lastIndexOf(':');
  if (ci < 0) return null;
  const qp = parseQuery(query);
  const address = addrPort.slice(0, ci).replace(/^\[|\]$/g, '');
  const port = parseInt(addrPort.slice(ci + 1), 10) || 443;
  return {
    id: uid(),
    name: frag || `${address}:${port} (HY2)`,
    protocol: 'hysteria2',
    address,
    port,
    uuid: pass,
    security: 'tls',
    sni: qp.get('sni') || '',
    raw: link,
  };
}

function parseWireguard(link: string): VpnConfig | null {
  const [, frag] = splitName(link);
  return {
    id: uid(),
    name: frag || 'WireGuard',
    protocol: 'wireguard',
    address: '',
    port: 51820,
    uuid: '',
    raw: link,
  };
}

export function parseV2rayLink(link: string): VpnConfig | null {
  try {
    link = sanitizeLink(link);
    if (!link) return null;
    const low = link.toLowerCase();
    if (low.startsWith('vless://')) return parseVless(link);
    if (low.startsWith('trojan://')) return parseTrojan(link);
    if (low.startsWith('vmess://')) return parseVmess(link);
    if (low.startsWith('ss://')) return parseSS(link);
    if (low.startsWith('hysteria2://') || low.startsWith('hy2://')) return parseHysteria2(link);
    if (low.startsWith('wireguard://')) return parseWireguard(link);
  } catch (e) {
    console.error('Parse error:', e);
  }
  return null;
}

const B64_LINE_RE = /^[A-Za-z0-9+/_=-]{20,}$/;

export function parseSubscriptionContent(content: string): VpnConfig[] {
  let text = content.replace(/^﻿/, '').trim();
  // whole-blob base64 (whitespace inside allowed)
  const compact = text.replace(/\s/g, '');
  if (!text.includes('://') && /^[A-Za-z0-9+/_=-]+$/.test(compact) && compact.length >= 20) {
    try {
      const d = b64decode(compact);
      if (d.includes('://')) text = d;
    } catch {
      // plain text
    }
  }
  const out: VpnConfig[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = sanitizeLink(line);
    if (!t || t.startsWith('#')) continue;
    if (/^https?:\/\//i.test(t)) continue; // nested sub url, not a config
    let cfg = parseV2rayLink(t);
    if (!cfg && B64_LINE_RE.test(t.replace(/\s/g, ''))) {
      // single base64-encoded line (commonly vmess json)
      try {
        cfg = parseV2rayLink(b64decode(t));
      } catch {
        cfg = null;
      }
    }
    if (cfg) out.push(cfg);
  }
  return out;
}

/** Build a share link from manual fields. */
export function buildLink(f: {
  protocol: Proto;
  address: string;
  port: number;
  uuid: string;
  name: string;
  security?: string;
  sni?: string;
  net?: string;
  path?: string;
  host?: string;
}): string {
  const tag = '#' + encodeURIComponent(f.name || `${f.address}:${f.port}`);
  if (f.protocol === 'vless') {
    const q = new URLSearchParams({
      security: f.security || 'tls',
      sni: f.sni || f.address,
      type: f.net || 'tcp',
    });
    if (f.path) q.set('path', f.path);
    if (f.host) q.set('host', f.host);
    return `vless://${f.uuid}@${f.address}:${f.port}?${q.toString()}${tag}`;
  }
  if (f.protocol === 'trojan') {
    const q = new URLSearchParams({ security: 'tls', sni: f.sni || f.address });
    return `trojan://${f.uuid}@${f.address}:${f.port}?${q.toString()}${tag}`;
  }
  if (f.protocol === 'vmess') {
    const obj = {
      v: '2',
      ps: f.name,
      add: f.address,
      port: String(f.port),
      id: f.uuid,
      net: f.net || 'tcp',
      tls: (f.security || 'tls') === 'tls' ? 'tls' : '',
      sni: f.sni || '',
    };
    return `vmess://${b64encodeUtf8(JSON.stringify(obj))}`;
  }
  return `${f.protocol}://${f.uuid}@${f.address}:${f.port}${tag}`;
}

/** Reachability probe: time-to-refuse/reset on the server port. -1 = unreachable/timeout. */
export async function probePing(address: string, port: number, timeoutMs = 3000): Promise<number> {
  if (!address) return -1;
  const t0 = Date.now();
  // We use a dummy URL. Fetch on a non-HTTP port will either time out or fail with "Network request failed"
  // (which usually means the port is open but not HTTP, or closed).
  // On most RN engines, "Network request failed" quickly means the host is there.
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  
  try {
    await fetch(`http://${address}:${port}/`, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: ctrl.signal as any,
    } as any);
    clearTimeout(tid);
    return Date.now() - t0;
  } catch (e: any) {
    clearTimeout(tid);
    if (e.message === 'Aborted' || e.name === 'AbortError') return -1;
    // If it failed but NOT due to timeout, it usually means we reached the port but it's not HTTP
    // or connection was refused. In many cases, this is enough to consider it "up".
    const dt = Date.now() - t0;
    return dt < 100 ? 100 : dt; // cap at 100 if it was instant
  }
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
