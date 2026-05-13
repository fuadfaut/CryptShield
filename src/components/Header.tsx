import { Bell } from '@phosphor-icons/react';
import { useAppStore } from '../store/appStore';

const titles: Record<string, string> = {
  dashboard: 'Dashboard',
  settings: 'Configuration',
  logs: 'System Logs',
};

export default function Header() {
  const activeTab = useAppStore((s) => s.activeTab);
  const hasNewLogs = useAppStore((s) => s.hasNewLogs);
  const switchTab = useAppStore((s) => s.switchTab);

  return (
    <header className="h-20 flex items-center justify-between px-8 border-b border-surface w-full bg-bgdark/80 backdrop-blur-sm z-10">
      <h2 id="page-title" className="text-2xl font-semibold text-white">
        {titles[activeTab] || 'Dashboard'}
      </h2>
      <div className="flex items-center space-x-4">
        <div className="px-3 py-1 bg-surface rounded-full text-xs font-mono text-gray-400 border border-gray-600">
          localhost:53
        </div>
        <button
          className="p-2 text-gray-400 hover:text-white transition-colors relative cursor-pointer"
          onClick={() => switchTab('logs')}
          title="View logs"
        >
          <Bell size={20} />
          {hasNewLogs && (
            <span
              id="notif-dot"
              className="absolute top-1 right-1 w-2 h-2 bg-fedora rounded-full"
            />
          )}
        </button>
      </div>
    </header>
  );
}
