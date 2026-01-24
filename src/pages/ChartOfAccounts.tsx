import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { Account, AccountType, accountTypeLabels, getDefaultNature } from '@/types/accounting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Plus, Search, ChevronRight, ChevronDown, Edit2, Trash2, 
  Wallet, CreditCard, Scale, TrendingUp, TrendingDown, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

const typeIcons: Record<AccountType, React.ReactNode> = {
  asset: <Wallet className="w-4 h-4" />,
  liability: <CreditCard className="w-4 h-4" />,
  equity: <Scale className="w-4 h-4" />,
  revenue: <TrendingUp className="w-4 h-4" />,
  expense: <TrendingDown className="w-4 h-4" />
};

const typeColors: Record<AccountType, string> = {
  asset: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  liability: 'bg-red-500/10 text-red-500 border-red-500/20',
  equity: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  revenue: 'bg-green-500/10 text-green-500 border-green-500/20',
  expense: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
};

// Radix Select forbids empty string values for SelectItem.
// We keep '' in form state to represent "no parent" and map a sentinel back to ''.
const ROOT_ACCOUNT_VALUE = '__root__';

interface AccountRowProps {
  account: Account & { children?: Account[] };
  level: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  allAccounts: Account[];
}

function AccountRow({ account, level, expandedIds, onToggle, onEdit, onDelete, allAccounts }: AccountRowProps) {
  const isExpanded = expandedIds.has(account.id);
  const children = allAccounts.filter(a => a.parent_id === account.id);
  const hasChildren = children.length > 0;

  return (
    <>
      <tr className={cn(
        "hover:bg-muted/50 transition-colors",
        account.is_header && "bg-muted/30 font-medium"
      )}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 20}px` }}>
            {hasChildren ? (
              <button
                onClick={() => onToggle(account.id)}
                className="p-0.5 hover:bg-muted rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span className="font-mono text-sm text-muted-foreground">{account.code}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={cn(account.is_header && "font-semibold")}>{account.name}</span>
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline" className={cn("gap-1", typeColors[account.account_type])}>
            {typeIcons[account.account_type]}
            {accountTypeLabels[account.account_type].en}
          </Badge>
        </td>
        <td className="px-4 py-3 text-right font-mono">
          {account.is_header ? '-' : `${Number(account.current_balance).toLocaleString('pt-AO')} Kz`}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" onClick={() => onEdit(account)}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onDelete(account)}
              disabled={hasChildren || account.is_header}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </td>
      </tr>
      {isExpanded && children.map(child => (
        <AccountRow
          key={child.id}
          account={child}
          level={level + 1}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          allAccounts={allAccounts}
        />
      ))}
    </>
  );
}

export default function ChartOfAccounts() {
  const { t } = useTranslation();
  const { accounts, isLoading, refetch, createAccount, updateAccount, deleteAccount, getParentAccounts } = useChartOfAccounts();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<AccountType | 'all'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    account_type: 'asset' as AccountType,
    account_nature: 'debit' as 'debit' | 'credit',
    parent_id: '',
    level: 1,
    is_header: false,
    opening_balance: 0
  });

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = 
      account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || account.account_type === filterType;
    return matchesSearch && matchesType;
  });

  const rootAccounts = filteredAccounts.filter(a => !a.parent_id);

  const handleToggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(accounts.filter(a => a.is_header).map(a => a.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const openCreateDialog = () => {
    setEditingAccount(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      account_type: 'asset',
      account_nature: 'debit',
      parent_id: '',
      level: 1,
      is_header: false,
      opening_balance: 0
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      description: account.description || '',
      account_type: account.account_type,
      account_nature: account.account_nature,
      parent_id: account.parent_id || '',
      level: account.level,
      is_header: account.is_header,
      opening_balance: Number(account.opening_balance) || 0
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (account: Account) => {
    if (!confirm(`Are you sure you want to delete "${account.name}"?`)) return;
    
    try {
      await deleteAccount(account.id);
      toast.success('Account deleted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete account');
    }
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.name) {
      toast.error('Code and Name are required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, {
          ...formData,
          parent_id: formData.parent_id || null
        });
        toast.success('Account updated successfully');
      } else {
        await createAccount({
          ...formData,
          parent_id: formData.parent_id || null
        });
        toast.success('Account created successfully');
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeChange = (type: AccountType) => {
    setFormData(prev => ({
      ...prev,
      account_type: type,
      account_nature: getDefaultNature(type)
    }));
  };

  // Calculate summary by type
  const summary = accounts.reduce((acc, account) => {
    if (!account.is_header) {
      const balance = Number(account.current_balance) || 0;
      acc[account.account_type] = (acc[account.account_type] || 0) + balance;
    }
    return acc;
  }, {} as Record<AccountType, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plano de Contas</h1>
          <p className="text-muted-foreground">Chart of Accounts - Manage your accounting structure</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          New Account
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(['asset', 'liability', 'equity', 'revenue', 'expense'] as AccountType[]).map(type => (
          <Card key={type} className={cn("border", typeColors[type].replace('bg-', 'border-').replace('/10', '/30'))}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {typeIcons[type]}
                <span className="text-sm font-medium">{accountTypeLabels[type].en}</span>
              </div>
              <p className="text-lg font-bold font-mono">
                {(summary[type] || 0).toLocaleString('pt-AO')} Kz
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as AccountType | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
                <SelectItem value="liability">Liabilities</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>Collapse All</Button>
              <Button variant="outline" size="icon" onClick={refetch}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Balance</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rootAccounts.map(account => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      level={0}
                      expandedIds={expandedIds}
                      onToggle={handleToggle}
                      onEdit={openEditDialog}
                      onDelete={handleDelete}
                      allAccounts={filteredAccounts}
                    />
                  ))}
                </tbody>
              </table>
              {rootAccounts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No accounts found
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Account' : 'New Account'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g., 4.1.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Type *</Label>
                <Select value={formData.account_type} onValueChange={(v) => handleTypeChange(v as AccountType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset (Activo)</SelectItem>
                    <SelectItem value="liability">Liability (Passivo)</SelectItem>
                    <SelectItem value="equity">Equity (Capital Próprio)</SelectItem>
                    <SelectItem value="revenue">Revenue (Receitas)</SelectItem>
                    <SelectItem value="expense">Expense (Gastos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Caixa Principal"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Parent Account</Label>
              <Select 
                value={formData.parent_id} 
                onValueChange={(v) => {
                  const parentId = v === ROOT_ACCOUNT_VALUE ? '' : v;
                  const parent = accounts.find(a => a.id === parentId);
                  setFormData(prev => ({ 
                    ...prev, 
                    parent_id: parentId,
                    level: parent ? parent.level + 1 : 1
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (Root account)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_ACCOUNT_VALUE}>None (Root account)</SelectItem>
                  {getParentAccounts().map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  value={formData.opening_balance}
                  onChange={(e) => setFormData(prev => ({ ...prev, opening_balance: Number(e.target.value) }))}
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Checkbox
                  id="is_header"
                  checked={formData.is_header}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_header: !!checked }))}
                />
                <Label htmlFor="is_header" className="cursor-pointer">
                  Header account (group only)
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingAccount ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
