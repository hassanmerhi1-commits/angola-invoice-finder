import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useERP";
import { LanguageProvider } from "@/i18n";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
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
import Placeholder from "./pages/Placeholder";
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
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
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
        <Route path="/accounting" element={<Placeholder />} />
        <Route path="/customers" element={<Placeholder />} />
        <Route path="/branches" element={<Placeholder />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Placeholder />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
