// Audit Trail Service — records system events to localStorage
// Import and call `auditLog(...)` from any module to record actions

export interface AuditEntry {
  id: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'approve' | 'reject' | 'void' | 'print' | 'export' | 'login' | 'logout' | 'restore' | 'transfer';
  module: string; // e.g. 'sales', 'products', 'hr'
  description: string;
  userName: string;
  userId: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

const AUDIT_KEY = 'kwanzaerp_audit_trail';
const MAX_ENTRIES = 5000;

export function getAuditLog(): AuditEntry[] {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch { return []; }
}

export function auditLog(
  action: AuditEntry['action'],
  module: string,
  description: string,
  userName = 'Sistema',
  userId = '',
  details?: Record<string, unknown>,
) {
  const entries = getAuditLog();
  entries.unshift({
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action,
    module,
    description,
    userName,
    userId,
    details,
    createdAt: new Date().toISOString(),
  });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
}
