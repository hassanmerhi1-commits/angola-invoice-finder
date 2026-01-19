// App Layout with Top Navigation (no sidebar)
import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { useBranches, useAuth } from '@/hooks/useERP';

export function AppLayout() {
  const { branches, currentBranch, setCurrentBranch } = useBranches();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav
        user={user}
        branches={branches}
        currentBranch={currentBranch}
        onBranchChange={setCurrentBranch}
        onLogout={logout}
      />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t bg-muted/30 py-3 px-4">
        <div className="container mx-auto flex items-center justify-center text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Kwanza ERP. Developed by Hassan Merhi. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
