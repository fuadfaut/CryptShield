import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardTab from './components/DashboardTab';
import SettingsTab from './components/SettingsTab';
import LogsTab from './components/LogsTab';
import Toast from './components/Toast';
import './index.css';

function App() {
  const activeTab = useAppStore((s) => s.activeTab);
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="h-screen w-screen flex antialiased">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-bgdark relative">
        <Header />

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'logs' && <LogsTab />}
        </div>
      </main>

      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}

export default App;
