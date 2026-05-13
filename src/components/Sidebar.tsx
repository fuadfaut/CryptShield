import {
  ShieldCheck,
  SquaresFour,
  Gear,
  TerminalWindow,
} from '@phosphor-icons/react';
import { useAppStore, type TabId } from '../store/appStore';

const navItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <SquaresFour size={20} />,
  },
  {
    id: 'settings',
    label: 'Configuration',
    icon: <Gear size={20} />,
  },
  {
    id: 'logs',
    label: 'System Logs',
    icon: <TerminalWindow size={20} />,
  },
];

export default function Sidebar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const isRunning = useAppStore((s) => s.isRunning);
  const switchTab = useAppStore((s) => s.switchTab);

  return (
    <aside className="w-64 bg-panel border-r border-surface flex flex-col justify-between shrink-0">
      {/* Logo */}
      <div>
        <div className="h-20 flex items-center px-6 border-b border-surface">
          <ShieldCheck size={28} weight="fill" className="text-fedora mr-3" />
          <h1 className="text-xl font-bold tracking-wide text-white">CryptShield</h1>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => switchTab(item.id)}
                className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-surface text-white'
                    : 'text-gray-400 hover:bg-surface hover:text-white'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-surface text-sm text-gray-400">
        <div className="flex items-center justify-between mb-2">
          <span>Daemon Version:</span>
          <span className="text-gray-300 font-mono">2.1.5</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Systemd:</span>
          <span
            id="systemd-status"
            className={`flex items-center ${isRunning ? 'text-green-400' : 'text-red-400'}`}
          >
            <span
              className={`w-2 h-2 rounded-full mr-2 ${
                isRunning ? 'bg-green-400 pulse-text' : 'bg-red-400'
              }`}
            />
            {isRunning ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </aside>
  );
}
