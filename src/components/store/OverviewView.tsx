import { useStore } from '@/store/StoreContext';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import heroBg from '@/assets/hero-bg.jpg';

interface Props { onNavigate: (v: 'shop' | 'admin') => void; }

export function OverviewView({ onNavigate }: Props) {
  const { settings } = useStore();

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

    </div>
  );
}
  );
}
