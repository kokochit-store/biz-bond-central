import { useStore } from '@/store/StoreContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Package, Receipt, Users, ArrowRight } from 'lucide-react';
import heroBg from '@/assets/hero-bg.jpg';

interface Props { onNavigate: (v: 'shop' | 'admin') => void; }

export function OverviewView({ onNavigate }: Props) {
  const { products, invoices, customers, ledger, settings, formatPrice } = useStore();

  const totalSales = invoices.reduce((s, i) => s + i.total, 0);
  const lowStock = products.filter((p) => p.stock <= p.reorderLevel);
  const totalReceivable = ledger.filter((l) => l.type === 'receivable').reduce((s, l) => s + l.amount, 0);

  const stats = [
    { label: 'Total Sales', value: formatPrice(totalSales), icon: Receipt, tone: 'bg-primary/10 text-primary' },
    { label: 'Items', value: products.length, icon: Package, tone: 'bg-accent text-accent-foreground' },
    { label: 'Customers', value: customers.length, icon: Users, tone: 'bg-success/10 text-success' },
    { label: 'Receivable', value: formatPrice(totalReceivable), icon: AlertTriangle, tone: 'bg-warning/10 text-warning-foreground' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${settings.heroImageUrl || heroBg})` }} />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.5)] via-transparent to-[hsl(20,70%,25%)]/60" />
        <div className="relative z-10 px-6 py-12 md:px-10 md:py-16 max-w-2xl space-y-4">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-primary-foreground drop-shadow-lg leading-tight">
            {settings.storeName}
          </h2>
          <p className="text-primary-foreground/90 text-base md:text-lg max-w-md drop-shadow leading-relaxed">
            {settings.storeNote}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button size="lg" onClick={() => onNavigate('shop')} className="gap-2 shadow-lg">
              ဈေးဝယ်ရန် <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => onNavigate('admin')}
              className="bg-background/20 text-primary-foreground border-primary-foreground/30 hover:bg-background/30 backdrop-blur-sm">
              Admin Panel
            </Button>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4 hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.tone}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">{s.label}</p>
              <p className="text-lg md:text-xl font-bold mt-1 truncate">{s.value}</p>
            </Card>
          );
        })}
      </div>

      {/* ALERTS */}
      <Card className="p-6">
        <h3 className="font-display text-xl mb-4">သတိပေးချက်များ / Low Stock Alerts</h3>
        {lowStock.length === 0 ? (
          <p className="text-sm text-muted-foreground">No low-stock alerts. ✓</p>
        ) : (
          <ul className="divide-y">
            {lowStock.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category} {p.location && `· ${p.location}`}</p>
                </div>
                <span className="text-sm font-semibold text-destructive">
                  Stock: {p.stock} (≤ {p.reorderLevel})
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
