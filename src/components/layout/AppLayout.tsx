// App Layout with Top Navigation (no sidebar)
import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { useBranches, useAuth } from '@/hooks/useERP';

export function AppLayout() {
  const { branches, currentBranch, setCurrentBranch } = useBranches();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        user={user}
        branches={branches}
        currentBranch={currentBranch}
        onBranchChange={setCurrentBranch}
        onLogout={logout}
      />
      <main className="min-h-[calc(100vh-6rem)]">
        <Outlet />
      </main>
    </div>
  );
}
