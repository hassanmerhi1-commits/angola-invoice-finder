import { Sale, Branch } from '@/types/erp';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer, X, Check } from 'lucide-react';

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  branch: Branch | null;
  onNewSale: () => void;
}

export function ReceiptDialog({
  open,
  onOpenChange,
  sale,
  branch,
  onNewSale,
}: ReceiptDialogProps) {
  if (!sale || !branch) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <Check className="w-5 h-5" />
            Venda Concluída
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div className="bg-white text-black rounded-lg p-4 font-mono text-xs space-y-2 print:block">
          <div className="text-center space-y-1">
            <h3 className="font-bold text-sm">{branch.name}</h3>
            <p>{branch.address}</p>
            <p>Tel: {branch.phone}</p>
            <p className="text-[10px]">NIF: 5000000000</p>
          </div>

          <Separator className="border-dashed" />

          <div className="text-center">
            <p className="font-bold">{sale.invoiceNumber}</p>
            <p>{new Date(sale.createdAt).toLocaleString('pt-AO')}</p>
          </div>

          <Separator className="border-dashed" />

          {/* Items */}
          <div className="space-y-1">
            {sale.items.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <div className="flex-1">
                  <p className="truncate">{item.productName}</p>
                  <p className="text-[10px] text-gray-600">
                    {item.quantity} x {item.unitPrice.toLocaleString('pt-AO')}
                  </p>
                </div>
                <span>{item.subtotal.toLocaleString('pt-AO')}</span>
              </div>
            ))}
          </div>

          <Separator className="border-dashed" />

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{sale.subtotal.toLocaleString('pt-AO')} Kz</span>
            </div>
            <div className="flex justify-between">
              <span>IVA 14%</span>
              <span>{sale.taxAmount.toLocaleString('pt-AO')} Kz</span>
            </div>
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span>
              <span>{sale.total.toLocaleString('pt-AO')} Kz</span>
            </div>
          </div>

          <Separator className="border-dashed" />

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Pagamento</span>
              <span className="uppercase">{sale.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span>Recebido</span>
              <span>{sale.amountPaid.toLocaleString('pt-AO')} Kz</span>
            </div>
            {sale.change > 0 && (
              <div className="flex justify-between font-bold">
                <span>Troco</span>
                <span>{sale.change.toLocaleString('pt-AO')} Kz</span>
              </div>
            )}
          </div>

          {(sale.customerNif || sale.customerName) && (
            <>
              <Separator className="border-dashed" />
              <div className="space-y-1">
                {sale.customerNif && (
                  <div className="flex justify-between">
                    <span>NIF Cliente</span>
                    <span>{sale.customerNif}</span>
                  </div>
                )}
                {sale.customerName && (
                  <div className="flex justify-between">
                    <span>Cliente</span>
                    <span>{sale.customerName}</span>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator className="border-dashed" />

          <div className="text-center text-[10px] space-y-1">
            <p>Documento processado por Kwanza ERP</p>
            <p>Obrigado pela preferência!</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" className="flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button className="flex-1" onClick={onNewSale}>
            Nova Venda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
