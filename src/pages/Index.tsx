import { useState } from 'react';
import { StoreProvider, useStore } from '@/store/StoreContext';
import { Sidebar } from '@/components/store/Sidebar';
import { OverviewView } from '@/components/store/OverviewView';
import { ShopView } from '@/components/store/ShopView';
import { InvoicesView } from '@/components/store/InvoicesView';
import { AdminView } from '@/components/store/AdminView';
import { CartDrawer } from '@/components/store/CartDrawer';
import { ViewName } from '@/types';
import { Menu, ShoppingCart } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

function StoreApp() {
  const { t } = useStore();
  const [view, setView] = useState<ViewName>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const titles: Record<ViewName, string> = {
    overview: t.overview,
    shop: t.shop,
    invoices: t.invoices,
    admin: t.admin,
  };

  const handleChange = (v: ViewName) => {
    setView(v);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden md:block">
        <Sidebar view={view} onChange={handleChange} />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar view={view} onChange={handleChange} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 md:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <h2 className="font-display font-semibold text-lg">{titles[view]}</h2>
          <Button
            variant="outline"
            size="icon"
            className="ml-auto md:hidden"
            onClick={() => window.dispatchEvent(new CustomEvent('open-cart'))}
          >
            <ShoppingCart className="w-4 h-4" />
          </Button>
        </header>

        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {view === 'overview' && <OverviewView onNavigate={(v) => setView(v)} />}
          {view === 'shop' && <ShopView />}
          {view === 'invoices' && <InvoicesView />}
          {view === 'admin' && <AdminView />}
        </div>
      </main>

      <CartDrawer />
    </div>
  );
}

const Index = () => (
  <StoreProvider>
    <StoreApp />
  </StoreProvider>
);

export default Index;
