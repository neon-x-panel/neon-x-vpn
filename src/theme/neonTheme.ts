export const NeonTheme = {
  colors: {
    bgApp: '#080b11',
    bgCard: '#111726',
    bgCardElevated: '#172033',
    bgInput: '#1b243b',
    border: 'rgba(255, 255, 255, 0.08)',
    borderNeonCyan: '#00f2fe',
    borderNeonGreen: '#06ffa5',
    borderNeonPurple: '#8b5cf6',

    // Text
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',

    // Accents & Gradients
    cyan: '#00f2fe',
    emerald: '#06ffa5',
    purple: '#8b5cf6',
    pink: '#ec4899',
    amber: '#f59e0b',
    red: '#ef4444',

    // Status Colors
    connected: '#06ffa5',
    connecting: '#f59e0b',
    disconnected: '#64748b',
    error: '#ef4444',
  },
  gradients: {
    powerConnected: ['#06ffa5', '#00f2fe'] as [string, string],
    powerConnecting: ['#f59e0b', '#ec4899'] as [string, string],
    powerDisconnected: ['#334155', '#1e293b'] as [string, string],
    cardGlow: ['rgba(0, 242, 254, 0.15)', 'rgba(139, 92, 246, 0.05)'] as [string, string],
    titleGradient: ['#06ffa5', '#00f2fe', '#8b5cf6'] as [string, string, string],
    brandButton: ['#8b5cf6', '#ec4899'] as [string, string],
    neonBorder: ['#06ffa5', '#8b5cf6'] as [string, string],
  },
  typography: {
    fontMono: 'monospace',
  }
};
