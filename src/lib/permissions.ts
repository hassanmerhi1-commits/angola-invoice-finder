// User Roles & Permissions System
export type UserRole = 'admin' | 'manager' | 'cashier' | 'viewer';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'sales' | 'inventory' | 'reports' | 'admin' | 'fiscal';
}

export interface RolePermissions {
  role: UserRole;
  permissions: string[];
}

// All available permissions
export const PERMISSIONS: Permission[] = [
  // Sales
  { id: 'pos_access', name: 'POS Access', description: 'Access Point of Sale', category: 'sales' },
  { id: 'pos_discount', name: 'Apply Discounts', description: 'Can apply discounts on sales', category: 'sales' },
  { id: 'pos_void', name: 'Void Sales', description: 'Can void completed sales', category: 'sales' },
  { id: 'pos_refund', name: 'Process Refunds', description: 'Can process refunds', category: 'sales' },
  
  // Inventory
  { id: 'inventory_view', name: 'View Inventory', description: 'Can view product list', category: 'inventory' },
  { id: 'inventory_create', name: 'Create Products', description: 'Can add new products', category: 'inventory' },
  { id: 'inventory_edit', name: 'Edit Products', description: 'Can modify products', category: 'inventory' },
  { id: 'inventory_delete', name: 'Delete Products', description: 'Can remove products', category: 'inventory' },
  { id: 'inventory_adjust', name: 'Adjust Stock', description: 'Can adjust stock quantities', category: 'inventory' },
  { id: 'inventory_transfer', name: 'Transfer Stock', description: 'Can transfer between branches', category: 'inventory' },
  { id: 'inventory_import', name: 'Import Products', description: 'Can import from Excel', category: 'inventory' },
  { id: 'inventory_export', name: 'Export Products', description: 'Can export to Excel', category: 'inventory' },
  { id: 'price_view', name: 'View Prices', description: 'Can view cost prices', category: 'inventory' },
  { id: 'price_edit', name: 'Edit Prices', description: 'Can modify prices', category: 'inventory' },
  
  // Reports
  { id: 'reports_daily', name: 'Daily Reports', description: 'Access daily reports', category: 'reports' },
  { id: 'reports_close', name: 'Close Day', description: 'Can close daily reports', category: 'reports' },
  { id: 'reports_financial', name: 'Financial Reports', description: 'Access financial data', category: 'reports' },
  { id: 'reports_audit', name: 'Audit Trail', description: 'View audit logs', category: 'reports' },
  
  // Fiscal
  { id: 'fiscal_invoices', name: 'View Invoices', description: 'Access invoices', category: 'fiscal' },
  { id: 'fiscal_credit', name: 'Credit Notes', description: 'Create credit notes', category: 'fiscal' },
  { id: 'fiscal_debit', name: 'Debit Notes', description: 'Create debit notes', category: 'fiscal' },
  { id: 'fiscal_transport', name: 'Transport Docs', description: 'Create transport documents', category: 'fiscal' },
  { id: 'fiscal_saft', name: 'SAF-T Export', description: 'Export SAF-T files', category: 'fiscal' },
  
  // Admin
  { id: 'admin_users', name: 'Manage Users', description: 'Create and edit users', category: 'admin' },
  { id: 'admin_roles', name: 'Manage Roles', description: 'Assign user roles', category: 'admin' },
  { id: 'admin_branches', name: 'Manage Branches', description: 'Create and edit branches', category: 'admin' },
  { id: 'admin_settings', name: 'System Settings', description: 'Modify system settings', category: 'admin' },
  { id: 'admin_backup', name: 'Backup Data', description: 'Create and restore backups', category: 'admin' },
];

// Default permissions by role
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions[] = [
  {
    role: 'admin',
    permissions: PERMISSIONS.map(p => p.id), // All permissions
  },
  {
    role: 'manager',
    permissions: [
      'pos_access', 'pos_discount', 'pos_void', 'pos_refund',
      'inventory_view', 'inventory_create', 'inventory_edit', 'inventory_adjust', 'inventory_transfer', 'inventory_import', 'inventory_export',
      'price_view', 'price_edit',
      'reports_daily', 'reports_close', 'reports_financial',
      'fiscal_invoices', 'fiscal_credit', 'fiscal_debit', 'fiscal_transport', 'fiscal_saft',
    ],
  },
  {
    role: 'cashier',
    permissions: [
      'pos_access', 'pos_discount',
      'inventory_view',
      'reports_daily',
      'fiscal_invoices',
    ],
  },
  {
    role: 'viewer',
    permissions: [
      'inventory_view',
      'reports_daily',
      'fiscal_invoices',
    ],
  },
];

// Role display names
export const ROLE_NAMES: Record<UserRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  cashier: 'Cashier',
  viewer: 'Viewer',
};

// Role colors for badges
export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-500',
  manager: 'bg-blue-500',
  cashier: 'bg-green-500',
  viewer: 'bg-gray-500',
};
