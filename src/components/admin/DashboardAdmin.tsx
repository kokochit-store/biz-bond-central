import { useStore } from '@/store/StoreContext';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Package, Receipt, Users } from 'lucide-react';

export function DashboardAdmin() {
  const { products, invoices, customers, ledger, formatPrice } = useStore();

  const totalSales = invoices.reduce((s, i) => s + i.total, 0);
  const lowStock = products.filter((p) => p.stock <= p.reorderLevel);
  const totalReceivable = ledger.filter((l) => l.type === 'receivable').reduce((s, l) => s + l.amount, 0);

  const stats = [
    { label: 'Total Sales / ရောင်းအား', value: formatPrice(totalSales), icon: Receipt, tone: 'bg-primary/10 text-primary' },
    { label: 'Items', value: products.length, icon: Package, tone: 'bg-accent text-accent-foreground' },
    { label: 'Customers', value: customers.length, icon: Users, tone: 'bg-success/10 text-success' },
    { label: 'Receivable', value: formatPrice(totalReceivable), icon: AlertTriangle, tone: 'bg-warning/10 text-warning-foreground' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
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
