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
import UserManagement from "./pages/UserManagement";
import Reports from "./pages/Reports";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import Branches from "./pages/Branches";
import Settings from "./pages/Settings";
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
      
      // In Electron, check persistent storage first
      if (window.electronAPI?.setup?.isComplete) {
        try {
          const result = await window.electronAPI.setup.isComplete();
          if (result.success) {
            setSetupComplete(result.complete);
            // Sync with localStorage for consistency
            localStorage.setItem('kwanza_setup_complete', result.complete ? 'true' : 'false');
            setIsCheckingSetup(false);
            return;
          }
        } catch (e) {
          console.error('Failed to check Electron setup status:', e);
        }
      }
      
      // Fallback to localStorage (web preview)
      const isComplete = localStorage.getItem('kwanza_setup_complete') === 'true';
      setSetupComplete(isComplete);
      setIsCheckingSetup(false);
    };
    
    checkSetupStatus();
    
    // Listen for storage changes
    const handleStorageChange = () => {
      const isComplete = localStorage.getItem('kwanza_setup_complete') === 'true';
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
        <Route path="/users" element={<UserManagement />} />
        <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
        <Route path="/accounting" element={<Branches />} />
        <Route path="/customers" element={<Clients />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/reports" element={<Reports />} />
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
