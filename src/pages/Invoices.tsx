import { useState } from 'react';
import { useSales } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';
import { useTranslation } from '@/i18n';
import { Sale } from '@/types/erp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, FileText, Eye, QrCode, Building2 } from 'lucide-react';
import { InvoiceViewDialog } from '@/components/invoice/InvoiceViewDialog';
import { SAFTExportDialog } from '@/components/fiscal/SAFTExportDialog';
import { CompanySettingsDialog } from '@/components/settings/CompanySettingsDialog';

export default function Invoices() {
  const { t, language } = useTranslation();
  const locale = language === 'pt' ? 'pt-AO' : 'en-US';
  const { currentBranch } = useBranchContext();
  const { sales } = useSales(currentBranch?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [saftDialogOpen, setSaftDialogOpen] = useState(false);
  const [companySettingsOpen, setCompanySettingsOpen] = useState(false);

  const filteredSales = sales.filter(sale =>
    sale.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.customerNif?.includes(searchTerm)
  );

  const handleViewInvoice = (sale: Sale) => {
    setSelectedSale(sale);
    setViewDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.invoices.title}</h1>
          <p className="text-muted-foreground">
            {t.invoices.subtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCompanySettingsOpen(true)}>
            <Building2 className="w-4 h-4 mr-2" />
            Config. Empresa
          </Button>
          <Button onClick={() => setSaftDialogOpen(true)}>
            <FileText className="w-4 h-4 mr-2" />
            {t.invoices.exportSaft}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Todas as Facturas</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Nenhuma factura encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Factura</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map(sale => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.invoiceNumber}</TableCell>
                    <TableCell>
                      {new Date(sale.createdAt).toLocaleString('pt-AO')}
                    </TableCell>
                    <TableCell>{sale.customerName || 'Consumidor Final'}</TableCell>
                    <TableCell>{sale.customerNif || '-'}</TableCell>
                    <TableCell className="text-right">
                      {sale.subtotal.toLocaleString('pt-AO')} Kz
                    </TableCell>
                    <TableCell className="text-right">
                      {sale.taxAmount.toLocaleString('pt-AO')} Kz
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {sale.total.toLocaleString('pt-AO')} Kz
                    </TableCell>
                    <TableCell>
                      <Badge variant={sale.status === 'completed' ? 'default' : 'destructive'}>
                        {sale.status === 'completed' ? 'Concluída' : 'Anulada'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleViewInvoice(sale)}
                          title="Ver factura"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleViewInvoice(sale)}
                          title="Ver QR Code AGT"
                        >
                          <QrCode className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoice View Dialog with AGT QR Code */}
      <InvoiceViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        sale={selectedSale}
        branch={currentBranch}
      />

      {/* SAF-T Export Dialog */}
      <SAFTExportDialog
        open={saftDialogOpen}
        onOpenChange={setSaftDialogOpen}
      />

      {/* Company Settings Dialog */}
      <CompanySettingsDialog
        open={companySettingsOpen}
        onOpenChange={setCompanySettingsOpen}
      />
    </div>
  );
}
