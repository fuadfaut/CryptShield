import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldWarning,
  Power,
  Check,
  SpinnerGap,
  Pulse,
  Globe,
  ChartLineUp,
  Clock,
} from '@phosphor-icons/react';
import { useAppStore, resolversDB } from '../store/appStore';

function formatUptime(seconds: number): string {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function DashboardTab() {
  const isRunning = useAppStore((s) => s.isRunning);
  const isStarting = useAppStore((s) => s.isStarting);
  const currentResolverId = useAppStore((s) => s.currentResolverId);
  const uptime = useAppStore((s) => s.uptime);
  const stats = useAppStore((s) => s.stats);
  const toggleService = useAppStore((s) => s.toggleService);
  const getLatency = useAppStore((s) => s.getLatency);

  const resolver = resolversDB[currentResolverId];

  // Latency updates every 3 seconds
  const [latency, setLatency] = useState(0);
  useEffect(() => {
    if (!isRunning) {
      setLatency(0);
      return;
    }
    setLatency(getLatency());
    const interval = setInterval(() => {
      setLatency(getLatency());
    }, 3000);
    return () => clearInterval(interval);
  }, [isRunning, currentResolverId, getLatency]);

  const blockPercentage = Math.min(
    (stats.blocked / Math.max(stats.total, 1)) * 100 * 3,
    100
  );

  return (
    <div className="h-full flex flex-col items-center max-w-5xl mx-auto pb-12 animate-[fadeIn_0.3s_ease-in-out]">
      {/* Top Row: Toggle Card + Live Stats */}
      <div className="w-full flex gap-6 mb-6">
        {/* Main Toggle Card */}
        <div className="bg-panel flex-1 rounded-3xl p-8 flex flex-col items-center justify-center border border-surface shadow-2xl relative overflow-hidden min-h-[320px]">
          {/* Status Glow */}
          <div
            id="status-glow"
            className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 blur-[80px] rounded-full transition-colors duration-700 ${
              isRunning ? 'bg-green-500/15' : 'bg-red-500/10'
            }`}
          />

          <div className="relative z-10 flex flex-col items-center">
            {/* Status Icon */}
            <div
              id="status-icon-container"
              className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-colors duration-500 shadow-inner ${
                isRunning
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {isRunning ? (
                <ShieldCheck size={48} weight="fill" />
              ) : (
                <ShieldWarning size={48} weight="fill" />
              )}
            </div>

            {/* Status Text */}
            <h3
              id="status-text"
              className={`text-2xl font-bold mb-2 transition-colors ${
                isRunning ? 'text-green-400 pulse-text' : 'text-white'
              }`}
            >
              {isRunning ? 'Protected' : 'Unprotected'}
            </h3>
            <p id="status-desc" className="text-gray-400 text-center mb-8 text-sm">
              {isRunning
                ? `Traffic encrypted via ${resolver.name}.`
                : 'System DNS is bypassing encryption.'}
            </p>

            {/* Power Toggle */}
            <button
              id="main-toggle"
              onClick={toggleService}
              disabled={isStarting}
              className={`relative group w-20 h-10 rounded-full p-1 border transition-colors duration-300 shadow-lg cursor-pointer ${
                isRunning
                  ? 'bg-green-500 border-green-600'
                  : 'bg-surface border-gray-600'
              }`}
            >
              <div
                id="toggle-knob"
                className={`w-8 h-8 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${
                  isRunning
                    ? 'translate-x-10 bg-white'
                    : 'translate-x-0 bg-gray-400'
                }`}
              >
                {isStarting ? (
                  <SpinnerGap size={14} className="animate-spin text-panel" />
                ) : isRunning ? (
                  <Check size={14} weight="bold" className="text-green-500" />
                ) : (
                  <Power size={14} className="text-panel" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Live Stats Card */}
        <div className="bg-panel w-1/3 rounded-3xl p-6 border border-surface shadow-2xl flex flex-col">
          <h4 className="text-gray-400 text-sm font-medium mb-4 uppercase tracking-wider flex items-center">
            <Pulse size={16} className="mr-2 text-fedora" />
            Live Traffic
          </h4>

          <div className="flex-1 flex flex-col justify-center space-y-6">
            {/* Total Queries */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Total Queries</span>
                <span id="stat-total" className="font-mono text-white">
                  {stats.total.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-surface rounded-full h-2">
                <div className="bg-blue-400 h-2 rounded-full w-full opacity-50" />
              </div>
            </div>

            {/* Blocked */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Blocked (Ad/Malware)</span>
                <span id="stat-blocked" className="font-mono text-red-400">
                  {stats.blocked.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-surface rounded-full h-2">
                <div
                  id="bar-blocked"
                  className="bg-red-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${blockPercentage}%` }}
                />
              </div>
            </div>

            {/* Status Text */}
            <div className="pt-4 border-t border-surface mt-2">
              <p
                id="stat-status-text"
                className={`text-xs text-center ${
                  isRunning ? 'text-green-400 pulse-text' : 'text-gray-500'
                }`}
              >
                {isRunning ? 'Analyzing network packets...' : 'Waiting for service to start...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-3 gap-6 w-full">
        {/* Active Resolver */}
        <div className="bg-panel rounded-2xl p-5 border border-surface flex items-center shadow-lg">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl mr-4">
            <Globe size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-400">Active Resolver</p>
            <p id="metric-resolver" className="text-lg font-semibold text-white truncate w-40">
              {isRunning ? resolver.name : 'None'}
            </p>
          </div>
        </div>

        {/* Avg. Latency */}
        <div className="bg-panel rounded-2xl p-5 border border-surface flex items-center shadow-lg">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl mr-4">
            <ChartLineUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-400">Avg. Latency</p>
            <p id="metric-latency" className="text-lg font-semibold text-white font-mono">
              {isRunning ? `${latency} ms` : '-- ms'}
            </p>
          </div>
        </div>

        {/* Uptime */}
        <div className="bg-panel rounded-2xl p-5 border border-surface flex items-center shadow-lg">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl mr-4">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-400">Uptime</p>
            <p id="metric-uptime" className="text-lg font-semibold text-white font-mono">
              {formatUptime(uptime)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
