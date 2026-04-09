

# Kwanza ERP — Production Checklist Plan

## Current State Assessment

After inspecting the codebase, here's the reality:

- **Backend PostgreSQL connection**: Fixed. `.env`, `db.js`, `docker-compose.yml` all use correct credentials (`yel3an7azi`).
- **Transaction Engine**: Well-architected (SAP-inspired 4-layer model) BUT still writes to `localStorage` and `window.electronAPI.db` (old SQLite path) instead of going through the API.
- **Direct storage calls**: **15 files** import from `@/lib/storage` directly, bypassing the API client. This is the biggest integrity risk.

---

## PHASE 1 — CORE STABILITY (Current Priority)

### Step 1: Backend connection ✅ DONE
PostgreSQL `.env`, `db.js`, Docker credentials all aligned.

### Step 2: Route all writes through the API client
The transaction engine (`src/lib/transactionEngine.ts`) currently calls `saveStockMovement`, `createLocalJournalEntry`, `updateProductStock` etc. from `@/lib/storage` — which writes to localStorage or Electron SQLite. This must be replaced with `api.*` calls from `src/lib/api/client.ts`.

**Files to migrate** (15 files with direct storage imports):
- `src/lib/transactionEngine.ts` — the most critical one
- `src/hooks/useERP.ts`
- `src/hooks/useUsers.ts`
- `src/hooks/useChartOfAccounts.ts`
- `src/hooks/useFiscalDocuments.ts`
- `src/hooks/useProForma.ts`
- `src/hooks/useSupplierReturns.ts`
- `src/contexts/BranchContext.tsx`
- `src/pages/Inventory.tsx`
- `src/pages/Journals.tsx`
- `src/pages/Branches.tsx`
- `src/components/inventory/BranchStockDetail.tsx`
- `src/components/reports/StockMovementReport.tsx`
- `src/lib/purchaseInvoiceStorage.ts`
- `src/lib/api/invoices.ts`

**Approach**: For each file, replace `storage.*` calls with corresponding `api.*` methods. Add any missing API endpoints to the backend.

### Step 3: Add missing backend API routes
Audit `src/lib/api/client.ts` methods vs backend `routes/` folder. Add any endpoints the frontend needs but the backend doesn't serve yet (e.g., stock movements CRUD, journal entries, open items).

### Step 4: Error handling standardization
- Backend: ensure all routes return `{ status, data, message }` format
- Frontend: show toast errors from API failures, no silent swallows

---

## PHASE 2 — DATA INTEGRITY

### Step 5: PostgreSQL constraints
Review all migration files. Add missing `NOT NULL`, `FOREIGN KEY`, `UNIQUE`, and indexes where absent.

### Step 6: Accounting correctness
- Add a database-level CHECK constraint ensuring journal entries balance (total debits = total credits per entry)
- Add period locking enforcement in the transaction engine backend route

### Step 7: Stock integrity
- Add CHECK constraint preventing negative stock (configurable)
- Ensure stock transfers are atomic (debit source + credit destination in one transaction)

---

## PHASE 3 — MULTI-USER / NETWORK

### Step 8: Concurrency testing
- Add optimistic locking (version column) to critical tables
- Test Socket.io real-time sync with multiple clients

### Step 9: Network access
- CORS already allows `*` — tighten to local network range
- Verify `http://192.168.x.x:3000` access works from client machines

### Step 10: Backup system
- Add `pg_dump` script to backend (scheduled + manual trigger)
- Verify `portable-export.sh` / `portable-import.sh` work end-to-end

---

## PHASES 4–6 — Already strong, refine after core is locked

- POS, Inventory, Accounting, Reports: optimize performance
- AGT compliance: validate hash chain + SAF-T export against spec
- Electron installer + auto-update: already working

---

## Recommended Execution Order

1. **Migrate transaction engine to API** (~biggest impact, ~1 session)
2. **Migrate remaining 14 files** from storage to API (~2 sessions)
3. **Add missing backend routes** as discovered during migration
4. **Add PostgreSQL constraints** (1 migration file)
5. **Test end-to-end**: Sale → Stock → Journal → Balance

This is the "define → build → lock → move on" approach. Each step is self-contained and testable before moving to the next.

