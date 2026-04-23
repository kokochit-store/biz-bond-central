import { useState, useMemo } from 'react';
import { useStore } from '@/store/StoreContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Search, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';

export function ShopView() {
  const { products, addToCart, formatPrice, prefs } = useStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const allLabel = prefs.language === 'my' ? 'အားလုံး' : 'All';
  const categories = useMemo(() => [allLabel, ...new Set(products.map((p) => p.category))], [products, allLabel]);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchesQ = !q || p.name.toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q);
    const matchesC = category === 'all' || category === allLabel || p.category === category;
    return matchesQ && matchesC;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">ပစ္စည်းအားလုံး</h1>
        <p className="text-sm text-muted-foreground">စုစုပေါင်း {products.length.toLocaleString()} မျိုး</p>
      </div>

      <div className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ပစ္စည်းအမည် / barcode ရှာရန်..."
            className="pl-10"
          />
        </div>
        <BarcodeScanButton
          onScan={(code) => {
            const hit = products.find((p) => (p.barcode || '').trim() === code.trim());
            if (hit) {
              if (hit.stock <= 0) return toast.error(`${hit.name} လက်ကျန်မရှိပါ`);
              addToCart(hit);
              toast.success(`${hit.name} ထည့်လိုက်ပါပြီ`);
            } else {
              setSearch(code);
              toast(`Barcode မတွေ့ပါ — "${code}" ဖြင့်ရှာပေးပါပြီ`);
            }
          }}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c === allLabel ? 'all' : c)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              (category === c) || (c === allLabel && category === 'all')
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
        {filtered.map((p) => {
          const low = p.stock <= p.reorderLevel;
          return (
            <Card key={p.id} className="group overflow-hidden hover:shadow-lg transition-all duration-300 animate-fade-in">
              <div className="relative aspect-square overflow-hidden bg-secondary">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-display text-5xl text-muted-foreground/30">
                    {p.name.charAt(0)}
                  </div>
                )}
                {p.badge && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground">
                    {p.badge}
                  </span>
                )}
                {low && (
                  <span className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold bg-destructive text-destructive-foreground">
                    Low
                  </span>
                )}
                <Button
                  size="icon"
                  disabled={p.stock <= 0}
                  onClick={() => { addToCart(p); toast.success(`${p.name} ထည့်လိုက်ပါပြီ`); }}
                  className="absolute bottom-3 right-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                >
                  <ShoppingBag className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-3 md:p-4">
                <p className="text-xs text-muted-foreground mb-1">{p.category}</p>
                <h3 className="font-medium text-sm line-clamp-1">{p.name}</h3>
                {p.location && <p className="text-xs text-muted-foreground mt-1">📍 {p.location}</p>}
                <div className="flex items-center justify-between mt-2 gap-2">
                  <span className="font-display font-bold text-primary text-sm md:text-base truncate">
                    {formatPrice(p.price)}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">×{p.stock}</span>
                </div>
                <Button
                  size="sm"
                  className="mt-3 w-full md:hidden"
                  disabled={p.stock <= 0}
                  onClick={() => { addToCart(p); toast.success(`${p.name} ထည့်လိုက်ပါပြီ`); }}
                >
                  <ShoppingBag className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">ပစ္စည်းမတွေ့ပါ</div>
      )}
    </div>
  );
}

function BarcodeScanButton({ onScan }: { onScan: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)} title="Scan barcode">
        <ScanLine className="w-4 h-4" />
      </Button>
      {open && (
        <BarcodeScannerModal
          onClose={() => setOpen(false)}
          onScan={(c) => {
            setOpen(false);
            onScan(c);
          }}
        />
      )}
    </>
  );
}
