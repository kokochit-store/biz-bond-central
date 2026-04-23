import { useState } from 'react';
import { useStore, uid } from '@/store/StoreContext';
import { PurchaseOrder, PurchaseLine } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Pencil, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';
import { SortableList } from '@/components/SortableList';

const empty: PurchaseOrder = {
  id: '', vendorName: '', status: 'ordered', orderDate: new Date().toISOString().slice(0, 10),
  expectedDate: '', lines: [{ itemName: '', orderedQty: 0, receivedQty: 0, cost: 0 }], note: '',
};

export function PurchasesAdmin() {
  const { purchases, vendors, products, upsertPurchase, deletePurchase, reorderPurchases, formatPrice } = useStore();
  const [form, setForm] = useState<PurchaseOrder>(empty);
  const [scanLineIdx, setScanLineIdx] = useState<number | null>(null);

  const updateLine = (i: number, k: keyof PurchaseLine, v: any) => {
    setForm((f) => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [k]: v };
      return { ...f, lines };
    });
  };
  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, { itemName: '', orderedQty: 0, receivedQty: 0, cost: 0 }] }));
  const removeLine = (i: number) => setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendorName) return toast.error('Vendor required');
    if (form.lines.length === 0) return toast.error('At least 1 item required');
    upsertPurchase({ ...form, id: form.id || uid() });
    toast.success('Purchase saved');
    setForm(empty);
  };

  const totalAmount = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + l.orderedQty * l.cost, 0);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h4 className="font-semibold mb-3">{form.id ? 'Edit Purchase Order' : 'New Purchase Order'}</h4>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs">Vendor *</label>
              <Input list="vendor-list" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} required />
              <datalist id="vendor-list">{vendors.map((v) => <option key={v.id} value={v.name} />)}</datalist>
            </div>
            <div>
              <label className="text-xs">Status</label>
              <select className="w-full h-10 px-3 rounded-md border bg-background text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                <option value="ordered">Ordered</option>
                <option value="partial">Partial Receive</option>
                <option value="received">Received</option>
              </select>
            </div>
            <div>
              <label className="text-xs">Order Date</label>
              <Input type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs">Expected Date</label>
              <Input type="date" value={form.expectedDate || ''} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Voucher Items</p>
              <Button type="button" size="sm" variant="outline" onClick={addLine}>
                <Plus className="w-3 h-3 mr-1" /> Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {form.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4 flex gap-1">
                    <Input className="flex-1" placeholder="Item name / barcode" value={l.itemName} onChange={(e) => updateLine(i, 'itemName', e.target.value)} />
                    <Button type="button" size="icon" variant="outline" className="shrink-0" onClick={() => setScanLineIdx(i)} title="Scan barcode">
                      <ScanLine className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input className="col-span-2" type="number" placeholder="Order Qty" value={l.orderedQty || ''} onChange={(e) => updateLine(i, 'orderedQty', Number(e.target.value))} />
                  <Input className="col-span-2" type="number" placeholder="Recv Qty" value={l.receivedQty || ''} onChange={(e) => updateLine(i, 'receivedQty', Number(e.target.value))} />
                  <Input className="col-span-3" type="number" placeholder="Cost" value={l.cost || ''} onChange={(e) => updateLine(i, 'cost', Number(e.target.value))} />
                  <Button type="button" size="icon" variant="ghost" className="col-span-1 text-destructive" onClick={() => removeLine(i)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Textarea placeholder="Note" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
          <div className="flex gap-2">
            <Button type="submit">Save Purchase</Button>
            <Button type="button" variant="outline" onClick={() => setForm(empty)}>Reset</Button>
          </div>
        </form>

        {scanLineIdx !== null && (
          <BarcodeScannerModal
            onClose={() => setScanLineIdx(null)}
            onScan={(code) => {
              const idx = scanLineIdx;
              setScanLineIdx(null);
              if (idx === null) return;
              const hit = products.find((p) => (p.barcode || '').trim() === code.trim());
              setForm((f) => {
                const lines = [...f.lines];
                lines[idx] = {
                  ...lines[idx],
                  itemName: hit ? hit.name : code,
                  cost: hit && !lines[idx].cost ? hit.cost : lines[idx].cost,
                };
                return { ...f, lines };
              });
              toast.success(hit ? `Matched: ${hit.name}` : `Scanned: ${code}`);
            }}
          />
        )}
      </Card>

      <Card className="p-4">
        <h4 className="font-semibold mb-3">Purchase Orders ({purchases.length})</h4>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No purchase orders.</p>
        ) : (
          <SortableList
            className="space-y-2"
            items={purchases}
            getId={(p) => p.id}
            onReorder={reorderPurchases}
            renderItem={(p) => (
              <div className="p-3 rounded-md bg-muted/40">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{p.vendorName}</p>
                    <p className="text-xs text-muted-foreground">{p.orderDate} · {p.status} · {p.lines.length} items · {formatPrice(totalAmount(p))}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setForm(p)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (confirm('Delete?')) deletePurchase(p.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          />
        )}
      </Card>
    </div>
  );
}
