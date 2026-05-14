import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Trash, Copy } from '@phosphor-icons/react';
import { useAppStore } from '../store/appStore';

export default function LogsTab() {
  const logs = useAppStore((s) => s.logs);
  const clearLogs = useAppStore((s) => s.clearLogs);
  const showToast = useAppStore((s) => s.showToast);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke('start_journal_stream').catch((e) => {
      showToast(`Failed to start log stream: ${e}`);
    });

    return () => {
      invoke('stop_journal_stream').catch(() => undefined);
    };
  }, [showToast]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const copyLogs = () => {
    const logText = logs.map((l) => `[${l.time}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(logText).then(
      () => showToast('Logs copied to clipboard'),
      () => showToast('Failed to copy logs')
    );
  };

  const typeClass: Record<string, string> = {
    info: 'log-info',
    error: 'log-error',
    success: 'log-success',
    warn: 'log-warn',
    system: 'log-system',
  };

  return (
    <div className="h-full flex flex-col animate-[fadeIn_0.3s_ease-in-out]">
      {/* Header Row */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-400 text-sm">
          Real-time output from{' '}
          <code className="bg-surface px-2 py-1 rounded text-fedora">
            journalctl -u dnscrypt-proxy
          </code>
        </p>
        <div className="space-x-2">
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-surface hover:bg-gray-700 text-white rounded-lg text-sm transition-colors border border-gray-600 cursor-pointer"
          >
            <Trash size={14} className="inline mr-1 -mt-0.5" />
            Clear
          </button>
          <button
            onClick={copyLogs}
            className="px-4 py-2 bg-surface hover:bg-gray-700 text-white rounded-lg text-sm transition-colors border border-gray-600 cursor-pointer"
          >
            <Copy size={14} className="inline mr-1 -mt-0.5" />
            Copy
          </button>
        </div>
      </div>

      {/* Log Container */}
      <div className="flex-1 bg-crust rounded-xl border border-surface p-4 overflow-hidden flex flex-col shadow-inner relative min-h-[400px]">
        <div
          id="log-container"
          ref={containerRef}
          className="flex-1 overflow-y-auto font-mono text-xs md:text-sm space-y-1 text-gray-300 pb-8 pr-2"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500 italic">
              Waiting for dnscrypt-proxy service to start...
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id}>
                <span className="text-gray-500">[{log.time}]</span>{' '}
                <span className={typeClass[log.type] || 'log-info'}>{log.message}</span>
              </div>
            ))
          )}
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-crust to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
