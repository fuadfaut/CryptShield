import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { 
  CheckCircle, 
  XCircle, 
  BookOpenText, 
  ShieldCheck, 
  TerminalWindow, 
  Wrench 
} from '@phosphor-icons/react';

function DepItem({ label, isInstalled, command }: { label: string, isInstalled: boolean, command: string }) {
  return (
    <div className="flex flex-col bg-bgdark p-4 rounded-xl border border-surface mb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {isInstalled ? (
            <CheckCircle size={24} weight="fill" className="text-green-500 mr-3" />
          ) : (
            <XCircle size={24} weight="fill" className="text-red-500 mr-3" />
          )}
          <span className="text-white font-medium">{label}</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${isInstalled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {isInstalled ? 'Installed' : 'Missing'}
        </span>
      </div>
      {!isInstalled && (
        <div className="mt-3 bg-mantle p-2 rounded-lg flex items-center justify-between">
          <code className="text-sm text-fedora font-mono">{command}</code>
          <button 
            onClick={() => navigator.clipboard.writeText(command)}
            className="text-xs bg-surface hover:bg-overlay text-white px-2 py-1 rounded transition-colors"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}

export default function TutorialTab() {
  const deps = useAppStore((s) => s.deps);
  const checkDependencies = useAppStore((s) => s.checkDependencies);

  useEffect(() => {
    checkDependencies();
  }, [checkDependencies]);

  const allInstalled = deps?.dnscrypt_proxy && deps?.nmcli && deps?.systemctl && deps?.pkexec;

  return (
    <div className="max-w-4xl mx-auto animate-[fadeIn_0.3s_ease-in-out]">
      {/* Dependency Checker Section */}
      <div className="bg-panel rounded-2xl border border-surface overflow-hidden shadow-lg mb-8">
        <div className="p-6 border-b border-surface bg-panel flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-white flex items-center">
              <Wrench size={20} className="text-fedora mr-2" />
              System Diagnostics
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Check if your Fedora system has all required packages installed.
            </p>
          </div>
          <button 
            onClick={checkDependencies}
            className="px-4 py-2 bg-surface hover:bg-overlay text-white text-sm rounded-lg transition-colors flex items-center"
          >
            Refresh Status
          </button>
        </div>
        
        <div className="p-6">
          {!deps ? (
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-10 bg-surface rounded w-full"></div>
                <div className="h-10 bg-surface rounded w-full"></div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DepItem 
                label="dnscrypt-proxy" 
                isInstalled={deps.dnscrypt_proxy} 
                command="sudo dnf install dnscrypt-proxy" 
              />
              <DepItem 
                label="NetworkManager (nmcli)" 
                isInstalled={deps.nmcli} 
                command="sudo dnf install NetworkManager" 
              />
              <DepItem 
                label="systemctl" 
                isInstalled={deps.systemctl} 
                command="sudo dnf install systemd" 
              />
              <DepItem 
                label="pkexec (Polkit)" 
                isInstalled={deps.pkexec} 
                command="sudo dnf install polkit" 
              />
            </div>
          )}
          
          {deps && allInstalled && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center">
              <ShieldCheck size={24} className="text-green-500 mr-3 shrink-0" />
              <p className="text-sm text-green-400">
                All required packages are installed. CryptShield is ready to secure your connection!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tutorial Guide Section */}
      <div className="bg-panel rounded-2xl border border-surface overflow-hidden shadow-lg">
        <div className="p-6 border-b border-surface">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <BookOpenText size={20} className="text-fedora mr-2" />
            Quick Setup Guide
          </h3>
        </div>
        <div className="p-6 space-y-6 text-gray-300 text-sm leading-relaxed">
          <div>
            <h4 className="text-white font-medium text-lg mb-2 flex items-center">
              <span className="w-6 h-6 rounded-full bg-fedora text-white flex items-center justify-center text-xs font-bold mr-2 shrink-0">1</span>
              Install Dependencies
            </h4>
            <p>CryptShield requires <code>dnscrypt-proxy</code> to function as the core daemon. If the diagnostics above show any missing packages, please copy the provided command and run it in your terminal to install them.</p>
          </div>
          
          <div>
            <h4 className="text-white font-medium text-lg mb-2 flex items-center">
              <span className="w-6 h-6 rounded-full bg-fedora text-white flex items-center justify-center text-xs font-bold mr-2 shrink-0">2</span>
              Choose a Resolver
            </h4>
            <p>Navigate to the <strong>Configuration</strong> tab. By default, it uses "All Servers" which load-balances your requests. You can select specific resolvers like <strong>Cloudflare</strong> for speed, <strong>Quad9</strong> for malware blocking, or <strong>AdGuard</strong> to block ads.</p>
          </div>

          <div>
            <h4 className="text-white font-medium text-lg mb-2 flex items-center">
              <span className="w-6 h-6 rounded-full bg-fedora text-white flex items-center justify-center text-xs font-bold mr-2 shrink-0">3</span>
              Enable Protection
            </h4>
            <p>Go to the <strong>Dashboard</strong> and click the large toggle switch. A system prompt will appear asking for your password. This is required because changing system-wide DNS routing needs Administrator (root) privileges. Once authenticated, your traffic will be routed through the encrypted tunnel.</p>
          </div>

          <div>
            <h4 className="text-white font-medium text-lg mb-2 flex items-center">
              <span className="w-6 h-6 rounded-full bg-fedora text-white flex items-center justify-center text-xs font-bold mr-2 shrink-0">4</span>
              Monitor Live Traffic
            </h4>
            <p className="flex items-center">
              <TerminalWindow size={18} className="text-fedora mr-2 inline" />
              The Live Traffic section displays the amount of DNS queries made by your system in real-time. If you use a resolver like AdGuard, it will also show you how many ads or malicious domains have been successfully blocked.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
