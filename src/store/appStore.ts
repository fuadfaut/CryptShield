import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';

// --- Resolver Database ---
export interface ResolverInfo {
  name: string;
  type: string;
  baseLatency: number;
}

export const resolversDB: Record<string, ResolverInfo & { exactName: string }> = {
  default: { name: 'All Servers (Load Balanced)', exactName: '', type: 'Auto', baseLatency: 10 },
  cloudflare: { name: 'Cloudflare', exactName: 'cloudflare', type: 'DoH/DNSCrypt', baseLatency: 12 },
  google: { name: 'Google DNS', exactName: 'google', type: 'DoH/DNSCrypt', baseLatency: 15 },
  quad9: { name: 'Quad9', exactName: 'quad9', type: 'DoH/DNSCrypt', baseLatency: 20 },
  adguard: { name: 'AdGuard DNS', exactName: 'adguard', type: 'DoH/DNSCrypt', baseLatency: 25 },
  nextdns: { name: 'NextDNS', exactName: 'nextdns', type: 'DoH', baseLatency: 30 },
  cisco: { name: 'Cisco OpenDNS', exactName: 'cisco', type: 'DoH/DNSCrypt', baseLatency: 20 },
  mullvad: { name: 'Mullvad', exactName: 'mullvad-doh', type: 'DoH', baseLatency: 35 },
  cleanbrowsing: { name: 'CleanBrowsing', exactName: 'cleanbrowsing-adult', type: 'DoH/DNSCrypt', baseLatency: 25 },
  tiarapp: { name: 'TiarApp (BebasID)', exactName: 'doh.tiar.app', type: 'DoH', baseLatency: 18 },
};

// --- Log Entry ---
export interface LogEntry {
  id: number;
  time: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warn' | 'system';
}

// --- Application State ---
export type TabId = 'dashboard' | 'settings' | 'logs' | 'tutorial';

export interface DependencyStatus {
  dnscrypt_proxy: boolean;
  nmcli: boolean;
  systemctl: boolean;
  pkexec: boolean;
}

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
  deps: DependencyStatus | null;

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
  applyChanges: () => Promise<void>;
  checkDependencies: () => Promise<void>;
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
  deps: null,
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

    let statsAccumulator = { total: 0, blocked: 0 };
    let statsTimeout: ReturnType<typeof setTimeout> | null = null;

    // Listen for real-time DNS traffic from dnscrypt-proxy
    await listen<string>('traffic-stream', (event) => {
      if (!get().isRunning) return;

      const line = event.payload;
      if (!line || line.trim() === '') return;
      
      const isBlocked = line.includes('DROP') || line.includes('REJECT') || line.includes('SYNTH');
      statsAccumulator.total += 1;
      if (isBlocked) statsAccumulator.blocked += 1;

      if (!statsTimeout) {
        statsTimeout = setTimeout(() => {
          set((state) => ({
            stats: {
              total: state.stats.total + statsAccumulator.total,
              blocked: state.stats.blocked + statsAccumulator.blocked,
            }
          }));
          statsAccumulator = { total: 0, blocked: 0 };
          statsTimeout = null;
        }, 1000);
      }
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
        await invoke('set_tray_icon', { active: true });
        await invoke('start_traffic_stream');
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
    // Limit to 200 logs to prevent memory leaks and DOM sluggishness
    const newLogs = [...state.logs, newLog];
    if (newLogs.length > 200) {
      newLogs.shift();
    }
    
    set({
      logs: newLogs,
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
    state.addLog(`[CONFIG] DNS Caching set to ${newValue} (Pending apply)`, 'info');
  },

  toggleDnssec: async () => {
    const state = get();
    const newValue = !state.dnssecEnabled;
    set({ dnssecEnabled: newValue });
    state.addLog(`[CONFIG] DNSSEC set to ${newValue} (Pending apply)`, 'info');
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

  applyChanges: async () => {
    const state = get();
    if (!state.isRunning) return;

    set({ isStarting: true });
    state.addLog('[SYSTEM] Polkit: Applying config changes and restarting service...', 'system');

    try {
      const res = resolversDB[state.currentResolverId];
      await invoke('restart_service', { 
        resolver: res.exactName,
        caching: state.cachingEnabled,
        dnssec: state.dnssecEnabled
      });
      await invoke('start_traffic_stream');
      
      set({ isStarting: false });
      state.showToast('Settings Applied & Service Restarted');
    } catch (e) {
      set({ isStarting: false });
      state.addLog(`[ERROR] Failed to apply changes: ${e}`, 'error');
    }
  },

  checkDependencies: async () => {
    try {
      const deps: DependencyStatus = await invoke('check_dependencies');
      set({ deps });
    } catch (e) {
      console.error('Failed to check dependencies', e);
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
    state.addLog(`[CONFIG] Target resolver set to: ${res.name}`, 'info');
  },

  toggleService: async () => {
    const state = get();
    if (state.isStarting) return;

    if (!state.isRunning) {
      // --- STARTING ---
      set({ isStarting: true });
      state.addLog('[SYSTEM] Polkit: Applying config and starting service...', 'system');

      try {
        const res = resolversDB[state.currentResolverId];
        await invoke('toggle_service', { 
          state: true,
          resolver: res.exactName,
          caching: state.cachingEnabled,
          dnssec: state.dnssecEnabled
        });
        
        const currentState = get();
        set({ isRunning: true, isStarting: false, uptime: 0, stats: { total: 0, blocked: 0 } });
        currentState.showToast('DNSCrypt Service Started');

        // Start uptime counter
        const uptimeInterval = setInterval(() => {
          set((s) => ({ uptime: s.uptime + 1 }));
        }, 1000);

        set({
          _intervals: {
            uptime: uptimeInterval,
            traffic: null,
          },
        });

        state.addLog('[SUCCESS] Service started successfully', 'success');
        
        await invoke('set_tray_icon', { active: true });
        await invoke('start_traffic_stream');

        // Refresh stats/latency after a short delay
        setTimeout(() => {
          set({ isRunning: true, isStarting: false, uptime: 0, stats: { total: 0, blocked: 0 } });
        }, 1000);
      } catch (e: any) {
        set({ isStarting: false });
        state.addLog(`[ERROR] Failed to start service: ${e}`, 'error');
      }

    } else {
      // --- STOPPING ---
      set({ isStarting: true });
      state.addLog('[SYSTEM] Polkit: Executing systemctl stop dnscrypt-proxy...', 'system');

      try {
        const res = resolversDB[state.currentResolverId];
        await invoke('toggle_service', { 
          state: false,
          resolver: res.exactName,
          caching: state.cachingEnabled,
          dnssec: state.dnssecEnabled 
        });
        
        await invoke('set_tray_icon', { active: false });
        await invoke('stop_traffic_stream');
        
        // Clean up intervals
        const intervals = get()._intervals;
        if (intervals.uptime) clearInterval(intervals.uptime);
        if (intervals.traffic) clearInterval(intervals.traffic);

        set({
          isRunning: false,
          isStarting: false,
          uptime: 0,
          stats: { total: 0, blocked: 0 },
          _intervals: { uptime: null, traffic: null },
        });

        state.addLog('[SUCCESS] Service stopped successfully', 'success');
      } catch (e: any) {
        set({ isStarting: false });
        state.addLog(`[ERROR] Failed to stop service: ${e}`, 'error');
      }
    }
  },
}));
