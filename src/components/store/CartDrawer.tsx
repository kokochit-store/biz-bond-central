import { useState } from 'react';
import { useStore } from '@/store/StoreContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Trash2, Minus, Plus, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { cart, updateCartQty, removeFromCart, clearCart, customers, products, addToCart, saveInvoice, formatPrice } = useStore();
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [paid, setPaid] = useState(0);
  const [saleType, setSaleType] = useState<'cash' | 'credit'>('cash');
  const [note, setNote] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-cart', handler);
    return () => window.removeEventListener('open-cart', handler);
  }, []);

  const total = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const totalCost = cart.reduce((s, c) => s + c.product.cost * c.qty, 0);
  const totalItems = cart.reduce((s, c) => s + c.qty, 0);

  const handleCustomerSelect = (id: string) => {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.name);
      setPhone(c.phone || '');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Customer name required');
      return;
    }
    saveInvoice({
      customerName,
      phoneNumber: phone,
      saleType,
      paidAmount: paid,
      note,
      total,
      totalCost,
      lines: cart.map((c) => ({
        productId: c.product.id,
        productName: c.product.name,
        qty: c.qty,
        price: c.product.price,
        cost: c.product.cost,
      })),
    });
    toast.success('Invoice saved');
    clearCart();
    setCustomerName(''); setPhone(''); setPaid(0); setNote(''); setCustomerId('');
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <SheetTitle>Shopping Cart</SheetTitle>
          <Button type="button" size="sm" variant="outline" onClick={() => setScanOpen(true)}>
            <ScanLine className="w-4 h-4 mr-1" /> Scan
          </Button>
        </SheetHeader>

        {scanOpen && (
          <BarcodeScannerModal
            onClose={() => setScanOpen(false)}
            onScan={(code) => {
              setScanOpen(false);
              const hit = products.find((p) => (p.barcode || '').trim() === code.trim());
              if (!hit) return toast.error(`Barcode "${code}" မတွေ့ပါ`);
              if (hit.stock <= 0) return toast.error(`${hit.name} လက်ကျန်မရှိပါ`);
              addToCart(hit);
              toast.success(`${hit.name} ထည့်လိုက်ပါပြီ`);
            }}
          />
        )}

        <div className="mt-4 space-y-2">
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cart is empty.</p>
          ) : (
            cart.map((c) => (
              <Card key={c.product.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.product.name}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(c.product.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateCartQty(c.product.id, c.qty - 1)}>
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{c.qty}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateCartQty(c.product.id, c.qty + 1)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(c.product.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted space-y-1 text-sm">
          <div className="flex justify-between"><span>Items</span><strong>{totalItems}</strong></div>
          <div className="flex justify-between"><span>Total</span><strong className="text-primary">{formatPrice(total)}</strong></div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium">Select Customer</label>
            <select
              className="w-full mt-1 h-9 px-3 rounded-md border bg-background text-sm"
              value={customerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Customer Name</label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium">Phone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Paid</label>
              <Input type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-medium">Type</label>
              <select
                className="w-full mt-1 h-9 px-3 rounded-md border bg-background text-sm"
                value={saleType}
                onChange={(e) => setSaleType(e.target.value as 'cash' | 'credit')}
              >
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Note</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <Button type="submit" className="w-full">Save Invoice</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
