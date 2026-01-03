import { useState, useEffect, useCallback } from 'react';
import { Branch, Product, Sale, User, CartItem, SaleItem } from '@/types/erp';
import * as storage from '@/lib/storage';

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranchState] = useState<Branch | null>(null);

  useEffect(() => {
    setBranches(storage.getBranches());
    const current = storage.getCurrentBranch();
    if (current) {
      setCurrentBranchState(current);
    } else {
      const mainBranch = storage.getBranches().find(b => b.isMain);
      if (mainBranch) {
        storage.setCurrentBranch(mainBranch);
        setCurrentBranchState(mainBranch);
      }
    }
  }, []);

  const setCurrentBranch = useCallback((branch: Branch) => {
    storage.setCurrentBranch(branch);
    setCurrentBranchState(branch);
  }, []);

  return { branches, currentBranch, setCurrentBranch };
}

export function useProducts(branchId?: string) {
  const [products, setProducts] = useState<Product[]>([]);

  const refreshProducts = useCallback(() => {
    setProducts(storage.getProducts(branchId));
  }, [branchId]);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  return { products, refreshProducts };
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((product: Product, quantity: number = 1) => {
    setItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                subtotal: (item.quantity + quantity) * item.product.price * (1 - item.discount / 100),
              }
            : item
        );
      }
      return [...prev, {
        product,
        quantity,
        discount: 0,
        subtotal: quantity * product.price,
      }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setItems(prev =>
        prev.map(item =>
          item.product.id === productId
            ? {
                ...item,
                quantity,
                subtotal: quantity * item.product.price * (1 - item.discount / 100),
              }
            : item
        )
      );
    }
  }, []);

  const setItemDiscount = useCallback((productId: string, discount: number) => {
    setItems(prev =>
      prev.map(item =>
        item.product.id === productId
          ? {
              ...item,
              discount,
              subtotal: item.quantity * item.product.price * (1 - discount / 100),
            }
          : item
      )
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const taxAmount = items.reduce((sum, item) => {
    const itemTax = item.subtotal * (item.product.taxRate / 100);
    return sum + itemTax;
  }, 0);
  const total = subtotal + taxAmount;

  return {
    items,
    addItem,
    updateQuantity,
    setItemDiscount,
    removeItem,
    clearCart,
    subtotal,
    taxAmount,
    total,
  };
}

export function useSales(branchId?: string) {
  const [sales, setSales] = useState<Sale[]>([]);

  const refreshSales = useCallback(() => {
    setSales(storage.getSales(branchId));
  }, [branchId]);

  useEffect(() => {
    refreshSales();
  }, [refreshSales]);

  const completeSale = useCallback((
    cartItems: CartItem[],
    branchCode: string,
    branchId: string,
    cashierId: string,
    paymentMethod: Sale['paymentMethod'],
    amountPaid: number,
    customerNif?: string,
    customerName?: string,
  ): Sale => {
    const saleItems: SaleItem[] = cartItems.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      sku: item.product.sku,
      quantity: item.quantity,
      unitPrice: item.product.price,
      discount: item.discount,
      taxRate: item.product.taxRate,
      taxAmount: item.subtotal * (item.product.taxRate / 100),
      subtotal: item.subtotal,
    }));

    const subtotal = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = saleItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const total = subtotal + taxAmount;

    const sale: Sale = {
      id: crypto.randomUUID(),
      invoiceNumber: storage.generateInvoiceNumber(branchCode),
      branchId,
      cashierId,
      items: saleItems,
      subtotal,
      taxAmount,
      discount: 0,
      total,
      paymentMethod,
      amountPaid,
      change: amountPaid - total,
      customerNif,
      customerName,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    storage.saveSale(sale);
    refreshSales();
    return sale;
  }, [refreshSales]);

  return { sales, completeSale, refreshSales };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentUser = storage.getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
  }, []);

  const login = useCallback((email: string, _password: string): boolean => {
    // Simple demo login - will be replaced with Supabase auth
    const users = storage.getUsers();
    const foundUser = users.find(u => u.email === email && u.isActive);
    if (foundUser) {
      storage.setCurrentUser(foundUser);
      setUser(foundUser);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    storage.setCurrentUser(null);
    setUser(null);
  }, []);

  return { user, isLoading, login, logout };
}
