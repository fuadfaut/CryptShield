import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';

// --- Resolver Database ---
export interface ResolverInfo {
  name: string;
  type: string;
  baseLatency: number;
  blockRate: number;
}

export const resolversDB: Record<string, ResolverInfo & { exactName: string }> = {
  default: { name: 'Load Balanced (All Servers)', type: 'Mixed', baseLatency: 20, blockRate: 0.0, exactName: '' },
  cloudflare: { name: 'Cloudflare', type: 'DoH/DNSCrypt', baseLatency: 14, blockRate: 0.01, exactName: 'cloudflare' },
  quad9: { name: 'Quad9', type: 'DNSCrypt', baseLatency: 38, blockRate: 0.15, exactName: 'quad9-dnscrypt-ip4-filter-pri' },
  adguard: { name: 'AdGuard DNS', type: 'DoH', baseLatency: 25, blockRate: 0.35, exactName: 'adguard-dns' },
  nextdns: { name: 'NextDNS', type: 'DoH', baseLatency: 45, blockRate: 0.25, exactName: 'nextdns' },
};

// --- Log Entry ---
export interface LogEntry {
  id: number;
  time: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warn' | 'system';
}

// --- Application State ---
export type TabId = 'dashboard' | 'settings' | 'logs';

interface AppState {
  // Service state
  isRunning: boolean;
  isStarting: boolean;
  currentResolverId: string;
  uptime: number;
  stats: { total: number; blocked: number };

  // UI state
  activeTab: TabId;
  logs: LogEntry[];
  hasNewLogs: boolean;
  toastMessage: string | null;

  // Settings
  cachingEnabled: boolean;
  dnssecEnabled: boolean;
  autostartEnabled: boolean;

  // Internals
  _isInitialized: boolean;
  _intervals: {
    uptime: ReturnType<typeof setInterval> | null;
    traffic: ReturnType<typeof setInterval> | null;
  };
  _logCounter: number;

  // Actions
  init: () => Promise<void>;
  switchTab: (tab: TabId) => void;
  toggleService: () => Promise<void>;
  changeResolver: (resolverId: string) => Promise<void>;
  addLog: (message: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
  showToast: (message: string) => void;
  dismissToast: () => void;
  toggleCaching: () => Promise<void>;
  toggleDnssec: () => Promise<void>;
  toggleAutostart: () => Promise<void>;
  getLatency: () => number;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isRunning: false,
  isStarting: false,
  currentResolverId: 'cloudflare',
  uptime: 0,
  stats: { total: 0, blocked: 0 },
  activeTab: 'dashboard',
  logs: [],
  hasNewLogs: false,
  toastMessage: null,
  cachingEnabled: true,
  dnssecEnabled: true,
  autostartEnabled: false,
  _isInitialized: false,
  _intervals: { uptime: null, traffic: null },
  _logCounter: 0,

  // --- Actions ---
  init: async () => {
    if (get()._isInitialized) return;
    set({ _isInitialized: true });

    // Listen for log streams from Rust backend
    await listen<string>('log-stream', (event) => {
      let type: LogEntry['type'] = 'info';
      if (event.payload.includes('[ERROR]') || event.payload.includes('Failed')) type = 'error';
      else if (event.payload.includes('[WARN]')) type = 'warn';
      else if (event.payload.includes('[SUCCESS]') || event.payload.includes('started')) type = 'success';
      get().addLog(event.payload, type);
    });

    try {
      // Get initial config
      const config: any = await invoke('get_config');
      if (config.server_names && config.server_names.length > 0) {
        // Try to match the config server name to our DB keys
        const name = config.server_names[0].toLowerCase();
        let matched = false;
        for (const key of Object.keys(resolversDB)) {
          if (name.includes(key)) {
            set({ currentResolverId: key });
            matched = true;
            break;
          }
        }
        if (!matched) set({ currentResolverId: 'default' });
      } else {
        set({ currentResolverId: 'default' });
      }
      set({
        cachingEnabled: config.cache !== false, // default true if undefined
        dnssecEnabled: config.require_dnssec !== false,
      });

      // Check autostart
      const autoStartStatus = await isEnabled();
      set({ autostartEnabled: autoStartStatus });

      // Get initial service status
      const status: string = await invoke('get_service_status');
      if (status === 'active') {
        set({ isRunning: true });
        // Start uptime counter
        const uptimeInterval = setInterval(() => {
          set((s) => ({ uptime: s.uptime + 1 }));
        }, 1000);
        set({ _intervals: { uptime: uptimeInterval, traffic: get()._intervals.traffic } });
      }
    } catch (e) {
      console.error('Failed to init app state:', e);
      get().addLog(`[SYSTEM] Init error: ${e}`, 'error');
    }
  },

  switchTab: (tab) => {
    set({ activeTab: tab });
    if (tab === 'logs') {
      set({ hasNewLogs: false });
    }
  },

  addLog: (message, type = 'info') => {
    const state = get();
    const time = new Date().toISOString().substring(11, 19);
    const newLog: LogEntry = {
      id: state._logCounter + 1,
      time,
      message,
      type,
    };
    set({
      logs: [...state.logs, newLog],
      _logCounter: state._logCounter + 1,
      hasNewLogs: state.activeTab !== 'logs',
    });
  },

  clearLogs: () => {
    set({ logs: [] });
    get().showToast('Logs cleared');
  },

  showToast: (message) => {
    set({ toastMessage: message });
    setTimeout(() => {
      set({ toastMessage: null });
    }, 3000);
  },

  dismissToast: () => set({ toastMessage: null }),

  toggleCaching: async () => {
    const state = get();
    const newValue = !state.cachingEnabled;
    set({ cachingEnabled: newValue });
    try {
      await invoke('update_option', { key: 'cache', value: newValue });
      state.addLog(`[CONFIG] Option 'DNS Caching' was set to ${newValue}.`, 'warn');
      if (state.isRunning) {
        state.addLog(`[SYSTEM] Restarting service to apply changes...`, 'system');
        await invoke('restart_service');
      }
    } catch (e) {
      state.addLog(`[ERROR] Failed to update config: ${e}`, 'error');
      set({ cachingEnabled: !newValue }); // rollback
    }
  },

  toggleDnssec: async () => {
    const state = get();
    const newValue = !state.dnssecEnabled;
    set({ dnssecEnabled: newValue });
    try {
      await invoke('update_option', { key: 'require_dnssec', value: newValue });
      state.addLog(`[CONFIG] Option 'DNSSEC' was set to ${newValue}.`, 'warn');
      if (state.isRunning) {
        state.addLog(`[SYSTEM] Restarting service to apply changes...`, 'system');
        await invoke('restart_service');
      }
    } catch (e) {
      state.addLog(`[ERROR] Failed to update config: ${e}`, 'error');
      set({ dnssecEnabled: !newValue }); // rollback
    }
  },

  toggleAutostart: async () => {
    const state = get();
    try {
      if (state.autostartEnabled) {
        await disable();
        set({ autostartEnabled: false });
        state.addLog(`[SYSTEM] Run on Startup disabled`, 'info');
      } else {
        await enable();
        set({ autostartEnabled: true });
        state.addLog(`[SYSTEM] Run on Startup enabled`, 'success');
      }
    } catch (e) {
      state.addLog(`[ERROR] Failed to toggle autostart: ${e}`, 'error');
    }
  },

  getLatency: () => {
    const state = get();
    if (!state.isRunning) return 0;
    const base = resolversDB[state.currentResolverId].baseLatency;
    const jitter = Math.floor(Math.random() * 10) - 5;
    return Math.max(1, base + jitter);
  },

  changeResolver: async (resolverId) => {
    const state = get();
    const res = resolversDB[resolverId];
    set({ currentResolverId: resolverId });
    state.addLog(`[CONFIG] Switching primary resolver to: ${res.name}`, 'warn');

    try {
      await invoke('update_resolver', { name: res.exactName });
      if (state.isRunning) {
        state.addLog(`[SYSTEM] Restarting dnscrypt-proxy daemon...`, 'system');
        state.showToast(`Resolver set to ${res.name}`);
      }
    } catch (e) {
      state.addLog(`[ERROR] Failed to change resolver: ${e}`, 'error');
    }
  },

  toggleService: async () => {
    const state = get();

    if (!state.isRunning) {
      // --- STARTING ---
      set({ isStarting: true });
      state.addLog('[SYSTEM] Polkit: Executing systemctl start dnscrypt-proxy...', 'system');

      try {
        await invoke('toggle_service', { state: true });
        
        const currentState = get();
        const res = resolversDB[currentState.currentResolverId];

        set({ isRunning: true, isStarting: false, uptime: 0, stats: { total: 0, blocked: 0 } });
        currentState.showToast('DNSCrypt Service Started');

        // Start uptime counter
        const uptimeInterval = setInterval(() => {
          set((s) => ({ uptime: s.uptime + 1 }));
        }, 1000);

        set({
          _intervals: {
            uptime: uptimeInterval,
            traffic: null, // removing mock traffic loop as real logs will be coming
          },
        });
      } catch (e) {
        set({ isStarting: false });
        get().addLog(`[ERROR] Failed to start service: ${e}`, 'error');
      }

    } else {
      // --- STOPPING ---
      set({ isStarting: true });
      state.addLog('[SYSTEM] Polkit: Executing systemctl stop dnscrypt-proxy...', 'system');

      try {
        await invoke('toggle_service', { state: false });
        
        // Clean up intervals
        const intervals = get()._intervals;
        if (intervals.uptime) clearInterval(intervals.uptime);
        if (intervals.traffic) clearInterval(intervals.traffic);

        set({
          isRunning: false,
          isStarting: false,
          uptime: 0,
          _intervals: { uptime: null, traffic: null },
        });

        get().addLog('[SYSTEM] Daemon exited smoothly.', 'system');
        get().showToast('Service Stopped');
      } catch (e) {
        set({ isStarting: false });
        get().addLog(`[ERROR] Failed to stop service: ${e}`, 'error');
      }
    }
  },
}));
