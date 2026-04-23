import { Package, ShoppingCart, FileText, Shield, Store } from 'lucide-react';
import { ViewName } from '@/types';
import { useStore } from '@/store/StoreContext';
import { cn } from '@/lib/utils';

interface Props {
  view: ViewName;
  onChange: (v: ViewName) => void;
}

export function Sidebar({ view, onChange }: Props) {
  const { settings, isAdmin, cart, t } = useStore();
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  const items: { id: ViewName; label: string; icon: typeof Package }[] = [
    { id: 'overview', label: t.overview, icon: Store },
    { id: 'shop', label: t.shop, icon: Package },
    { id: 'invoices', label: t.invoices, icon: FileText },
    { id: 'admin', label: t.admin, icon: Shield },
  ];

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-sidebar-hover">
        <div className="flex items-center gap-3">
          {settings.logoImageUrl ? (
            <img src={settings.logoImageUrl} alt="logo" className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-sidebar-active flex items-center justify-center font-bold text-primary-foreground font-display">
              PT
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider opacity-60">Offline Store</p>
            <h1 className="font-display font-semibold text-sm leading-tight truncate">{settings.storeName}</h1>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          const active = view === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                active ? 'bg-sidebar-active text-primary-foreground' : 'hover:bg-sidebar-hover'
              )}
            >
              <Icon className="w-4 h-4" />
              {it.label}
              {it.id === 'admin' && isAdmin && (
                <span className="ml-auto text-[10px] bg-success px-1.5 py-0.5 rounded">ON</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-hover space-y-2">
        <div className="flex items-center justify-between text-xs px-2">
          <span className="opacity-70">Admin</span>
          <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium',
            isAdmin ? 'bg-success text-success-foreground' : 'bg-sidebar-hover'
          )}>
            {isAdmin ? 'Unlocked' : 'Locked'}
          </span>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-cart'))}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-sidebar-active text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> {t.cart}</span>
          <span className="bg-black/20 px-2 py-0.5 rounded text-xs">{cartCount}</span>
        </button>
      </div>
    </aside>
  );
}
