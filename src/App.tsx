import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useERP";
import { LanguageProvider } from "@/i18n";
import { BranchProvider } from "@/contexts/BranchContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Invoices from "./pages/Invoices";
import Inventory from "./pages/Inventory";
import DailyReports from "./pages/DailyReports";
import Clients from "./pages/Clients";
import StockTransfer from "./pages/StockTransfer";
import DataSync from "./pages/DataSync";
import Suppliers from "./pages/Suppliers";
import PurchaseOrders from "./pages/PurchaseOrders";
import Categories from "./pages/Categories";
import FiscalDocuments from "./pages/FiscalDocuments";
import ProForma from "./pages/ProForma";
import UserManagement from "./pages/UserManagement";
import Reports from "./pages/Reports";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import Branches from "./pages/Branches";
import Settings from "./pages/Settings";
import Expenses from "./pages/Expenses";
import BankAccounts from "./pages/BankAccounts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  
  // Check if first-time setup is needed - use state to make it reactive
  const [setupComplete, setSetupComplete] = React.useState<boolean | null>(null);
  const [isCheckingSetup, setIsCheckingSetup] = React.useState(true);
  
  // Check setup status from Electron storage or localStorage
  React.useEffect(() => {
    const checkSetupStatus = async () => {
      setIsCheckingSetup(true);
      
      const isElectron = !!window.electronAPI?.isElectron;
      console.log('[Setup Check] Environment:', isElectron ? 'Electron' : 'Web');
      
      // In Electron, check persistent storage first
      if (isElectron && window.electronAPI?.setup?.isComplete) {
        try {
          const result = await window.electronAPI.setup.isComplete();
          console.log('[Setup Check] Electron result:', result);
          if (result.success) {
            setSetupComplete(result.complete);
            // Sync with localStorage for consistency
            localStorage.setItem('kwanza_setup_complete', result.complete ? 'true' : 'false');
            setIsCheckingSetup(false);
            return;
          }
        } catch (e) {
          console.error('[Setup Check] Failed to check Electron setup status:', e);
        }
      }
      
      // Fallback to localStorage (web preview)
      // For web preview, also verify that role is set (not just the flag)
      const setupFlag = localStorage.getItem('kwanza_setup_complete');
      const isServerMode = localStorage.getItem('kwanza_is_server');
      const serverConfig = localStorage.getItem('kwanza_server_config');
      const clientConfig = localStorage.getItem('kwanza_client_config');
      
      // Setup is only truly complete if we have the flag AND configuration data
      const hasConfig = isServerMode !== null || serverConfig !== null || clientConfig !== null;
      const isComplete = setupFlag === 'true' && hasConfig;
      
      console.log('[Setup Check] localStorage state:', { 
        setupFlag, 
        isServerMode, 
        hasServerConfig: !!serverConfig, 
        hasClientConfig: !!clientConfig,
        isComplete 
      });
      
      setSetupComplete(isComplete);
      setIsCheckingSetup(false);
    };
    
    checkSetupStatus();
    
    // Listen for storage changes
    const handleStorageChange = () => {
      const setupFlag = localStorage.getItem('kwanza_setup_complete');
      const hasConfig = localStorage.getItem('kwanza_is_server') !== null || 
                        localStorage.getItem('kwanza_server_config') !== null || 
                        localStorage.getItem('kwanza_client_config') !== null;
      const isComplete = setupFlag === 'true' && hasConfig;
      setSetupComplete(isComplete);
    };
    
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  
  // Show loading while checking setup status
  if (isCheckingSetup || setupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  return (
    <Routes>
      {/* Setup route - only accessible if setup not complete */}
      <Route 
        path="/setup" 
        element={setupComplete ? <Navigate to="/login" replace /> : <Setup />} 
      />
      
      {/* Redirect to setup if not complete */}
      <Route 
        path="/login" 
        element={
          !setupComplete ? <Navigate to="/setup" replace /> :
          user ? <Navigate to="/" replace /> : <Login />
        } 
      />
      
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route 
          path="/" 
          element={!setupComplete ? <Navigate to="/setup" replace /> : <Dashboard />} 
        />
        <Route path="/pos" element={<POS />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/daily-reports" element={<DailyReports />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/stock-transfer" element={<StockTransfer />} />
        <Route path="/data-sync" element={<DataSync />} />
        <Route path="/fiscal-documents" element={<FiscalDocuments />} />
        <Route path="/proforma" element={<ProForma />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
        <Route path="/accounting" element={<Branches />} />
        <Route path="/customers" element={<Clients />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/bank-accounts" element={<BankAccounts />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  const isElectron =
    typeof window !== "undefined" && !!window.electronAPI?.isElectron;

  // BrowserRouter breaks under file:// URLs (Electron packaged apps) because
  // window.location.pathname becomes something like /C:/.../dist/index.html.
  // HashRouter avoids that by using the URL hash for routing.
  const Router = isElectron ? HashRouter : BrowserRouter;

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BranchProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Router>
              <AppRoutes />
            </Router>
          </TooltipProvider>
        </BranchProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;
