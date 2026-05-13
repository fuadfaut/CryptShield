import { HardDrives, SlidersHorizontal } from '@phosphor-icons/react';
import { useAppStore, resolversDB } from '../store/appStore';

export default function SettingsTab() {
  const currentResolverId = useAppStore((s) => s.currentResolverId);
  const changeResolver = useAppStore((s) => s.changeResolver);
  const cachingEnabled = useAppStore((s) => s.cachingEnabled);
  const dnssecEnabled = useAppStore((s) => s.dnssecEnabled);
  const autostartEnabled = useAppStore((s) => s.autostartEnabled);
  const toggleCaching = useAppStore((s) => s.toggleCaching);
  const toggleDnssec = useAppStore((s) => s.toggleDnssec);
  const toggleAutostart = useAppStore((s) => s.toggleAutostart);
  const isRunning = useAppStore((s) => s.isRunning);
  const isStarting = useAppStore((s) => s.isStarting);
  const applyChanges = useAppStore((s) => s.applyChanges);

  return (
    <div className="max-w-4xl mx-auto animate-[fadeIn_0.3s_ease-in-out]">
      {/* Resolver Selection */}
      <div className="bg-panel rounded-2xl border border-surface overflow-hidden shadow-lg mb-6">
        <div className="p-6 border-b border-surface">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <HardDrives size={20} className="text-fedora mr-2" />
            Resolver Selection
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Select the upstream server. Changes apply immediately to the simulation.
          </p>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Primary Server List
          </label>
          <select
            id="resolver-select"
            value={currentResolverId}
            onChange={(e) => changeResolver(e.target.value)}
            className="w-full bg-bgdark border border-surface text-white text-sm rounded-lg focus:ring-fedora focus:border-fedora block p-3 outline-none appearance-none cursor-pointer hover:bg-bgdark/80 transition-colors"
          >
            {Object.entries(resolversDB).map(([id, info]) => (
              <option key={id} value={id}>
                {info.name} ({info.type}) -{' '}
                {id === 'cloudflare'
                  ? 'Fast & Privacy Focused'
                  : id === 'quad9'
                  ? 'Malware Blocking'
                  : id === 'adguard'
                  ? 'Ad & Tracker Blocking'
                  : 'Custom Configurations'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="bg-panel rounded-2xl border border-surface overflow-hidden shadow-lg">
        <div className="p-6 border-b border-surface">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <SlidersHorizontal size={20} className="text-fedora mr-2" />
            Advanced Options
          </h3>
        </div>
        <div className="p-6 space-y-6">
          {/* DNS Caching */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-white font-medium">DNS Caching</h4>
              <p className="text-sm text-gray-400">
                Improve response times by caching queries locally.
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                id="opt-caching"
                checked={cachingEnabled}
                onChange={toggleCaching}
              />
              <div className="toggle-track" />
            </label>
          </div>

          {/* DNSSEC */}
          <div className="flex items-center justify-between border-t border-surface pt-6">
            <div>
              <h4 className="text-white font-medium">Require DNSSEC</h4>
              <p className="text-sm text-gray-400">
                Strictly enforce DNSSEC validation for all queries.
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                id="opt-dnssec"
                checked={dnssecEnabled}
                onChange={toggleDnssec}
              />
              <div className="toggle-track" />
            </label>
          </div>

          {/* Autostart */}
          <div className="flex items-center justify-between border-t border-surface pt-6">
            <div>
              <h4 className="text-white font-medium">Run on System Startup</h4>
              <p className="text-sm text-gray-400">
                Automatically launch CryptShield in the system tray when you log in.
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                id="opt-autostart"
                checked={autostartEnabled}
                onChange={toggleAutostart}
              />
              <div className="toggle-track" />
            </label>
          </div>
        </div>
      </div>

      {/* Apply Button (Visible only when running) */}
      {isRunning && (
        <div className="mt-8 flex justify-center animate-bounce-slow">
          <button
            onClick={applyChanges}
            disabled={isStarting}
            className="flex items-center px-8 py-3 bg-fedora hover:bg-fedora/90 text-white font-bold rounded-full shadow-lg shadow-fedora/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Applying...
              </>
            ) : (
              <>Apply & Restart Service</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
