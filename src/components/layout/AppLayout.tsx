import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useBranches, useAuth } from '@/hooks/useERP';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { branches, currentBranch, setCurrentBranch } = useBranches();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={user}
        branches={branches}
        currentBranch={currentBranch}
        onBranchChange={setCurrentBranch}
        onLogout={logout}
        onMenuClick={() => setSidebarOpen(true)}
      />
      <div className="flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 lg:ml-0 min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
