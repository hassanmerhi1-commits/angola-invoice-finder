import { useBranches, useSales, useProducts } from '@/hooks/useERP';
import { useTranslation } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

export default function Dashboard() {
  const { t, language } = useTranslation();
  const { currentBranch } = useBranches();
  const { sales } = useSales(currentBranch?.id);
  const { products } = useProducts(currentBranch?.id);

  const locale = language === 'pt' ? 'pt-AO' : 'en-US';

  // Calculate stats
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter(s => s.createdAt.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayTransactions = todaySales.length;
  
  const lowStockProducts = products.filter(p => p.stock <= 10 && p.isActive);
  const totalProducts = products.filter(p => p.isActive).length;

  // Mock comparison data
  const revenueChange = 12.5;
  const transactionChange = 8.2;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.dashboard.title}</h1>
        <p className="text-muted-foreground">
          {currentBranch?.name || t.common.all}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.todayRevenue}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayRevenue.toLocaleString(locale)} {t.common.currency}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {revenueChange >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              <span className={revenueChange >= 0 ? 'text-green-500' : 'text-red-500'}>
                {Math.abs(revenueChange)}%
              </span>
              {t.dashboard.vsYesterday}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.todaySales}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTransactions}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {transactionChange >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              <span className={transactionChange >= 0 ? 'text-green-500' : 'text-red-500'}>
                {Math.abs(transactionChange)}%
              </span>
              {t.dashboard.vsYesterday}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.productsInStock}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              {lowStockProducts.length} {t.dashboard.lowStock}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.pos.tax}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todaySales.reduce((sum, s) => sum + s.taxAmount, 0).toLocaleString(locale)} {t.common.currency}
            </div>
            <p className="text-xs text-muted-foreground">
              14% {language === 'pt' ? 'sobre vendas' : 'on sales'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.recentSales}</CardTitle>
        </CardHeader>
        <CardContent>
          {todaySales.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t.dashboard.noSalesToday}
            </p>
          ) : (
            <div className="space-y-4">
              {todaySales.slice(0, 5).map(sale => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{sale.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleTimeString(locale)} •{' '}
                      {sale.items.length} {language === 'pt' ? 'itens' : 'items'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{sale.total.toLocaleString(locale)} {t.common.currency}</p>
                    <p className="text-xs text-muted-foreground uppercase">{sale.paymentMethod}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="text-orange-500 flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t.inventory.lowStockAlert}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {lowStockProducts.map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                  </div>
                  <span className="text-orange-500 font-bold">{product.stock} {language === 'pt' ? 'un' : 'pcs'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
