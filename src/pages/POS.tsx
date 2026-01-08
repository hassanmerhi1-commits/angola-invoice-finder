import { useState, useCallback, useRef } from 'react';
import { useBranches, useProducts, useCart, useSales, useAuth } from '@/hooks/useERP';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { Sale, Product } from '@/types/erp';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { CheckoutDialog } from '@/components/pos/CheckoutDialog';
import { ReceiptDialog } from '@/components/pos/ReceiptDialog';
import { Search, ScanBarcode } from 'lucide-react';
import { toast } from 'sonner';

export default function POS() {
  const { currentBranch } = useBranches();
  const { products, refreshProducts } = useProducts(currentBranch?.id);
  const { user } = useAuth();
  const cart = useCart();
  const { completeSale } = useSales(currentBranch?.id);

  const [searchTerm, setSearchTerm] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle barcode scan
  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      // Don't process if user is typing in the search input
      if (document.activeElement === searchInputRef.current) {
        return;
      }

      const product = products.find(
        (p) =>
          p.isActive &&
          p.stock > 0 &&
          (p.barcode === barcode ||
            p.sku.toLowerCase() === barcode.toLowerCase())
      );

      if (product) {
        cart.addItem(product);
        setLastScannedBarcode(barcode);
        toast.success(`${product.name} adicionado`, {
          description: `Código: ${barcode}`,
        });
        // Clear indicator after 2 seconds
        setTimeout(() => setLastScannedBarcode(null), 2000);
      } else {
        toast.error('Produto não encontrado', {
          description: `Código: ${barcode}`,
        });
      }
    },
    [products, cart]
  );

  useBarcodeScanner({ onScan: handleBarcodeScan });

  const handleCheckout = () => {
    if (cart.items.length > 0) {
      setCheckoutOpen(true);
    }
  };

  const handleCompleteSale = (
    paymentMethod: Sale['paymentMethod'],
    amountPaid: number,
    customerNif?: string,
    customerName?: string,
  ) => {
    if (!currentBranch || !user) return;

    const sale = completeSale(
      cart.items,
      currentBranch.code,
      currentBranch.id,
      user.id,
      paymentMethod,
      amountPaid,
      customerNif,
      customerName,
    );

    setLastSale(sale);
    setCheckoutOpen(false);
    setReceiptOpen(true);
    refreshProducts();
  };

  const handleNewSale = () => {
    cart.clearCart();
    setReceiptOpen(false);
    setLastSale(null);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Products Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Pesquisar produto por nome, SKU ou código de barras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant={lastScannedBarcode ? 'default' : 'outline'} className="flex items-center gap-1.5 py-1.5 px-3">
              <ScanBarcode className="w-4 h-4" />
              {lastScannedBarcode ? lastScannedBarcode : 'Scanner Pronto'}
            </Badge>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <ProductGrid
            products={products}
            onProductSelect={(product) => cart.addItem(product)}
            searchTerm={searchTerm}
          />
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 border-l bg-card flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Carrinho de Compras</h2>
          <p className="text-xs text-muted-foreground">{currentBranch?.name}</p>
        </div>
        <div className="flex-1 p-4 overflow-hidden">
          <Cart
            items={cart.items}
            subtotal={cart.subtotal}
            taxAmount={cart.taxAmount}
            total={cart.total}
            onUpdateQuantity={cart.updateQuantity}
            onRemoveItem={cart.removeItem}
            onCheckout={handleCheckout}
          />
        </div>
      </div>

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        items={cart.items}
        total={cart.total}
        taxAmount={cart.taxAmount}
        onCompleteSale={handleCompleteSale}
      />

      {/* Receipt Dialog */}
      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        sale={lastSale}
        branch={currentBranch}
        onNewSale={handleNewSale}
      />
    </div>
  );
}
