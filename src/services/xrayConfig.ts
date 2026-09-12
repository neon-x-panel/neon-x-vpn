import { VpnConfig } from './configParser';

export type RoutingMode = 'bypass_iran' | 'global' | 'direct';

function streamSettings(cfg: VpnConfig): any {
  const net = cfg.net || 'tcp';
  const sec = (cfg.security || '').toLowerCase();
  const s: any = { network: net };
  if (sec === 'reality') {
    s.security = 'reality';
    s.realitySettings = {
      serverName: cfg.sni || cfg.address,
      fingerprint: cfg.fp || 'chrome',
      publicKey: cfg.pbk || '',
      shortId: cfg.sid || '',
      spiderX: cfg.spiderX || '/',
    };
  } else if (sec === 'tls') {
    s.security = 'tls';
    const tls: any = {
      serverName: cfg.sni || cfg.address,
      fingerprint: cfg.fp || 'chrome',
    };
    if (cfg.alpn) tls.alpn = cfg.alpn.split(',').map(x => x.trim()).filter(Boolean);
    s.tlsSettings = tls;
  } else {
    s.security = 'none';
  }
  if (net === 'ws') {
    s.wsSettings = { path: cfg.path || '/', headers: cfg.host ? { Host: cfg.host } : {} };
  } else if (net === 'grpc') {
    s.grpcSettings = { serviceName: (cfg.path || '').replace(/^\//, '') || 'xray' };
  } else if (net === 'http' || net === 'httphup' || net === 'h2') {
    s.httpSettings = { path: cfg.path || '/', host: cfg.host ? [cfg.host] : [cfg.address] };
  }
  return s;
}

function proxyOutbound(cfg: VpnConfig): any {
  const stream = streamSettings(cfg);
  if (cfg.protocol === 'vless') {
    const user: any = { id: cfg.uuid, encryption: 'none', level: 8 };
    if (cfg.flow) user.flow = cfg.flow;
    return {
      protocol: 'vless',
      tag: 'proxy',
      settings: {
        vnext: [
          {
            address: cfg.address,
            port: cfg.port,
            users: [user],
          },
        ],
      },
      streamSettings: stream,
    };
  }
  if (cfg.protocol === 'vmess') {
    const useTls = cfg.port === 443;
    const st = { ...stream };
    if (useTls && st.security === 'none') {
      st.security = 'tls';
      st.tlsSettings = { serverName: cfg.sni || cfg.address };
    }
    return {
      protocol: 'vmess',
      tag: 'proxy',
      settings: {
        vnext: [
          {
            address: cfg.address,
            port: cfg.port,
            users: [{ id: cfg.uuid, alterId: 0, security: 'auto', level: 8 }],
          },
        ],
      },
      streamSettings: st,
    };
  }
  if (cfg.protocol === 'trojan') {
    const tls: any = {
      serverName: cfg.sni || cfg.address,
      fingerprint: cfg.fp || 'chrome',
    };
    if (cfg.alpn) tls.alpn = cfg.alpn.split(',').map(x => x.trim()).filter(Boolean);
    return {
      protocol: 'trojan',
      tag: 'proxy',
      settings: { servers: [{ address: cfg.address, port: cfg.port, password: cfg.uuid, level: 8 }] },
      streamSettings: { ...stream, security: 'tls', tlsSettings: tls },
    };
  }
  if (cfg.protocol === 'ss') {
    const ci = cfg.uuid.indexOf(':');
    const method = ci >= 0 ? cfg.uuid.slice(0, ci) : cfg.security || 'aes-256-gcm';
    const password = ci >= 0 ? cfg.uuid.slice(ci + 1) : cfg.uuid;
    return {
      protocol: 'shadowsocks',
      tag: 'proxy',
      settings: { servers: [{ address: cfg.address, port: cfg.port, method, password, level: 8 }] },
    };
  }
  if (cfg.protocol === 'hysteria2') {
    return {
      protocol: 'hysteria2',
      tag: 'proxy',
      settings: {
        servers: [
          {
            address: cfg.address,
            port: cfg.port,
            password: cfg.uuid,
            tls: { enabled: true, serverName: cfg.sni || cfg.address },
          },
        ],
      },
    };
  }
  throw new Error(`پروتکل ${cfg.protocol} برای اتصال پشتیبانی نمی‌شود`);
}

export function sanitizeOutbound(proxy: any): void {
  try {
    const vnext = proxy?.settings?.vnext;
    if (Array.isArray(vnext)) {
      for (const vn of vnext) {
        for (const u of vn?.users || []) {
          if (u && (u.flow === '' || u.flow == null)) delete u.flow;
        }
      }
    }
    const tls = proxy?.streamSettings?.tlsSettings;
    if (tls) {
      if (Array.isArray(tls.alpn) && tls.alpn.length === 0) delete tls.alpn;
      if (tls.fingerprint === '' || tls.fingerprint == null) delete tls.fingerprint;
      delete tls.allowInsecure;
    }
    const reality = proxy?.streamSettings?.realitySettings;
    if (reality) {
      if (!reality.publicKey) delete reality.publicKey;
      if (!reality.shortId) delete reality.shortId;
      if (!reality.spiderX) delete reality.spiderX;
    }
  } catch { /* never break connect on sanitize */ }
}

const V2RAYNG_INBOUNDS = [
  {
    tag: 'socks',
    port: 10808,
    protocol: 'socks',
    settings: {
      auth: 'noauth',
      udp: true,
      userLevel: 8,
    },
    sniffing: {
      enabled: true,
      destOverride: ['http', 'tls', 'quic'],
    },
  },
  {
    tag: 'tun',
    protocol: 'tun',
    settings: {
      name: 'xray0',
      MTU: 1500,
      userLevel: 8,
    },
    sniffing: {
      enabled: true,
      destOverride: ['http', 'tls', 'quic'],
    },
  },
];

const DEFAULT_POLICY = {
  levels: {
    '8': {
      handshake: 4,
      connIdle: 300,
      uplinkOnly: 1,
      downlinkOnly: 1,
    },
  },
  system: {
    statsOutboundUplink: true,
    statsOutboundDownlink: true,
  },
};

export function buildXrayConfig(cfg: VpnConfig, mode: RoutingMode, dns: string): string {
  const proxy = proxyOutbound(cfg);
  sanitizeOutbound(proxy);

  const conf = {
    log: { loglevel: 'warning' },
    policy: DEFAULT_POLICY,
    dns: { servers: [dns === 'google' ? '8.8.8.8' : dns === 'system' ? 'localhost' : '1.1.1.1'] },
    inbounds: V2RAYNG_INBOUNDS,
    outbounds: [
      proxy,
      { protocol: 'freedom', tag: 'direct' },
      { protocol: 'blackhole', tag: 'block' },
    ],
    routing: { domainStrategy: 'AsIs', rules: [] },
  };
  return JSON.stringify(conf);
}
