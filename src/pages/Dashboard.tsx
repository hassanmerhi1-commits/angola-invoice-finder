import { useBranches, useSales, useProducts } from '@/hooks/useERP';
import { useTranslation } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Users,
  CreditCard,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  MapPin,
  Camera,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useDailyWallpaper } from '@/hooks/useDailyWallpaper';

export default function Dashboard() {
  const { t, language } = useTranslation();
  const { currentBranch } = useBranches();
  const { sales } = useSales(currentBranch?.id);
  const { products } = useProducts(currentBranch?.id);
  const wallpaper = useDailyWallpaper();

  const locale = language === 'pt' ? 'pt-AO' : 'en-US';
  const dateLocale = language === 'pt' ? pt : undefined;

  // Calculate stats
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter(s => s.createdAt.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayTransactions = todaySales.length;
  
  const lowStockProducts = products.filter(p => p.stock <= 10 && p.isActive);
  const totalProducts = products.filter(p => p.isActive).length;
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const averageOrderValue = sales.length > 0 ? totalRevenue / sales.length : 0;

  // Mock comparison data
  const revenueChange = 12.5;
  const transactionChange = 8.2;
  const productChange = -2.3;
  const avgOrderChange = 5.7;

  // Generate last 7 days sales data for area chart
  const last7DaysData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySales = sales.filter(s => s.createdAt.startsWith(dateStr));
    return {
      date: format(date, 'EEE', { locale: dateLocale }),
      fullDate: format(date, 'dd MMM', { locale: dateLocale }),
      revenue: daySales.reduce((sum, s) => sum + s.total, 0),
      transactions: daySales.length,
      tax: daySales.reduce((sum, s) => sum + s.taxAmount, 0),
    };
  });

  // Payment methods breakdown
  const paymentMethodsData = [
    { name: 'Dinheiro', value: sales.filter(s => s.paymentMethod === 'cash').length, color: 'hsl(var(--primary))' },
    { name: 'Cartão', value: sales.filter(s => s.paymentMethod === 'card').length, color: 'hsl(142 76% 36%)' },
    { name: 'Transferência', value: sales.filter(s => s.paymentMethod === 'transfer').length, color: 'hsl(47 96% 53%)' },
    { name: 'Misto', value: sales.filter(s => s.paymentMethod === 'mixed').length, color: 'hsl(280 67% 54%)' },
  ].filter(p => p.value > 0);

  // Top products by sales
  const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  sales.forEach(sale => {
    sale.items.forEach(item => {
      const existing = productSalesMap.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.subtotal;
      } else {
        productSalesMap.set(item.productId, {
          name: item.productName,
          quantity: item.quantity,
          revenue: item.subtotal,
        });
      }
    });
  });
  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Hourly sales distribution
  const hourlyData = Array.from({ length: 12 }, (_, i) => {
    const hour = 8 + i;
    const hourSales = todaySales.filter(s => {
      const saleHour = new Date(s.createdAt).getHours();
      return saleHour === hour;
    });
    return {
      hour: `${hour}h`,
      sales: hourSales.length,
      revenue: hourSales.reduce((sum, s) => sum + s.total, 0),
    };
  });

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    gradient,
    subtitle 
  }: { 
    title: string; 
    value: string; 
    change: number; 
    icon: any;
    gradient: string;
    subtitle?: string;
  }) => (
    <Card className="relative overflow-hidden border-0 shadow-lg">
      <div className={`absolute inset-0 ${gradient} opacity-10`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-xl ${gradient}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {change !== 0 && (
            <span className={`flex items-center text-xs font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(change)}%
            </span>
          )}
          <span className="text-xs text-muted-foreground">{subtitle || t.dashboard.vsYesterday}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="relative min-h-screen">
      {/* Background Wallpaper */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
        style={{ backgroundImage: `url(${wallpaper.image})` }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
      
      {/* Content */}
      <div className="relative p-6 space-y-6">
        {/* Wallpaper Info Badge */}
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/60 backdrop-blur-md border border-border/50 shadow-lg">
            <Camera className="h-4 w-4 text-primary" />
            <div className="text-xs">
              <div className="font-semibold text-foreground">{wallpaper.name}</div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {wallpaper.location}
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {t.dashboard.title}
            </h1>
            <p className="text-muted-foreground mt-1">
              {currentBranch?.name || t.common.all} • {format(new Date(), "EEEE, dd 'de' MMMM", { locale: dateLocale })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="modern-outline" size="lg">
              <BarChart3 />
              Relatórios
            </Button>
            <Button variant="modern" size="lg">
              <Zap />
              Acção Rápida
            </Button>
          </div>
        </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t.dashboard.todayRevenue}
          value={`${todayRevenue.toLocaleString(locale)} Kz`}
          change={revenueChange}
          icon={DollarSign}
          gradient="bg-gradient-to-br from-primary to-blue-600"
        />
        <StatCard
          title={t.dashboard.todaySales}
          value={todayTransactions.toString()}
          change={transactionChange}
          icon={ShoppingCart}
          gradient="bg-gradient-to-br from-green-500 to-emerald-600"
          subtitle={language === 'pt' ? 'transações' : 'transactions'}
        />
        <StatCard
          title={t.dashboard.productsInStock}
          value={totalProducts.toString()}
          change={productChange}
          icon={Package}
          gradient="bg-gradient-to-br from-orange-500 to-amber-600"
          subtitle={`${lowStockProducts.length} ${t.dashboard.lowStock}`}
        />
        <StatCard
          title={language === 'pt' ? 'Ticket Médio' : 'Avg. Order'}
          value={`${averageOrderValue.toLocaleString(locale, { maximumFractionDigits: 0 })} Kz`}
          change={avgOrderChange}
          icon={CreditCard}
          gradient="bg-gradient-to-br from-purple-500 to-violet-600"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart - Takes 2 columns */}
        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  {language === 'pt' ? 'Vendas dos Últimos 7 Dias' : 'Last 7 Days Sales'}
                </CardTitle>
                <CardDescription>
                  {language === 'pt' ? 'Receita e número de transações' : 'Revenue and transaction count'}
                </CardDescription>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Receita</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Transações</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last7DaysData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTransactions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="fullDate" 
                    axisLine={false} 
                    tickLine={false}
                    className="text-xs fill-muted-foreground"
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'revenue' ? `${value.toLocaleString(locale)} Kz` : value,
                      name === 'revenue' ? 'Receita' : 'Transações'
                    ]}
                    labelFormatter={(label) => label}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods Pie Chart */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              {language === 'pt' ? 'Métodos de Pagamento' : 'Payment Methods'}
            </CardTitle>
            <CardDescription>
              {language === 'pt' ? 'Distribuição por tipo' : 'Distribution by type'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {paymentMethodsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentMethodsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Sem dados de pagamento
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {paymentMethodsData.map((method, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: method.color }} />
                  <span className="text-sm text-muted-foreground">{method.name}</span>
                  <span className="text-sm font-medium ml-auto">{method.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hourly Distribution */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {language === 'pt' ? 'Vendas por Hora (Hoje)' : 'Hourly Sales (Today)'}
            </CardTitle>
            <CardDescription>
              {language === 'pt' ? 'Padrão de vendas ao longo do dia' : 'Sales pattern throughout the day'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis 
                    dataKey="hour" 
                    axisLine={false} 
                    tickLine={false}
                    className="text-xs fill-muted-foreground"
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    className="text-xs fill-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                    }}
                    formatter={(value: number) => [`${value} vendas`, 'Vendas']}
                  />
                  <Bar 
                    dataKey="sales" 
                    fill="hsl(var(--primary))" 
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {language === 'pt' ? 'Produtos Mais Vendidos' : 'Top Selling Products'}
            </CardTitle>
            <CardDescription>
              {language === 'pt' ? 'Por receita gerada' : 'By revenue generated'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Sem vendas registadas
              </div>
            ) : (
              <div className="space-y-4">
                {topProducts.map((product, index) => {
                  const maxRevenue = topProducts[0]?.revenue || 1;
                  const percentage = (product.revenue / maxRevenue) * 100;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="font-medium truncate max-w-[200px]">{product.name}</span>
                        </div>
                        <span className="text-sm font-bold">{product.revenue.toLocaleString(locale)} Kz</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{product.quantity} unidades vendidas</span>
                        <span>{percentage.toFixed(0)}% do top</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales & Alerts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Sales */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              {t.dashboard.recentSales}
            </CardTitle>
            <CardDescription>
              {language === 'pt' ? 'Últimas transações de hoje' : 'Latest transactions today'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {todaySales.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>{t.dashboard.noSalesToday}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySales.slice(0, 5).map(sale => (
                  <div 
                    key={sale.id} 
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/50 to-transparent rounded-xl hover:from-muted transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{sale.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} •{' '}
                          {sale.items.length} {language === 'pt' ? 'itens' : 'items'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{sale.total.toLocaleString(locale)} Kz</p>
                      <p className="text-xs text-muted-foreground uppercase">{sale.paymentMethod}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className="border-0 shadow-lg border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="text-orange-500 flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t.inventory.lowStockAlert}
            </CardTitle>
            <CardDescription>
              {language === 'pt' ? 'Produtos com stock baixo' : 'Products with low stock'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>{language === 'pt' ? 'Nenhum produto com stock baixo' : 'No low stock products'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.slice(0, 5).map(product => (
                  <div 
                    key={product.id} 
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-500/10 to-transparent rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                        <Package className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-orange-500/20 text-orange-500 font-bold text-sm">
                        {product.stock} {language === 'pt' ? 'un' : 'pcs'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}