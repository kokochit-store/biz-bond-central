import { useMemo, useRef, useState } from 'react';
import { useStore, uid } from '@/store/StoreContext';
import { PurchaseOrder, PurchaseLine } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Pencil, ScanLine, Upload, Printer, Download, AlertTriangle, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';
import { SortableList } from '@/components/SortableList';
import { mapCsvToPurchases } from '@/lib/csvSimple';
import { printHtml } from '@/lib/print';
import { purchaseHtml } from '@/lib/printTemplates';
import { exportPurchasesCsv } from '@/lib/csvExport';

const empty: PurchaseOrder = {
  id: '', vendorName: '', status: 'ordered', orderDate: new Date().toISOString().slice(0, 10),
  expectedDate: '', lines: [{ itemName: '', orderedQty: 0, receivedQty: 0, cost: 0 }], note: '',
};

export function PurchasesAdmin() {
  const { purchases, vendors, products, settings, upsertPurchase, deletePurchase, reorderPurchases, formatPrice } = useStore();
  const [form, setForm] = useState<PurchaseOrder>(empty);
  const [scanLineIdx, setScanLineIdx] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCsv = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const result = mapCsvToPurchases(text);
      if (!result.records.length) {
        toast.error('No purchase orders found');
        return;
      }
      result.records.forEach((p) => upsertPurchase(p));
      toast.success(`Imported ${result.records.length} purchase orders${result.skipped ? ` · ${result.skipped} rows skipped` : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setImporting(false);
    }
  };

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

  // ---- Low Stock grouped by vendor ----
  const lowByVendor = useMemo(() => {
    const groups = new Map<string, { vendorName: string; items: typeof products }>();
    for (const p of products) {
      if (p.stock < (p.reorderLevel || 0)) {
        const v = vendors.find((x) => x.id === p.vendorId);
        const key = v?.name || 'Unassigned';
        if (!groups.has(key)) groups.set(key, { vendorName: key, items: [] });
        groups.get(key)!.items.push(p);
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.vendorName.localeCompare(b.vendorName));
  }, [products, vendors]);

  const autoPoForVendor = (vendorName: string, items: typeof products) => {
    const lines: PurchaseLine[] = items.map((p) => ({
      itemName: p.name,
      orderedQty: Math.max((p.reorderLevel || 0) * 2 - p.stock, 1),
      receivedQty: 0,
      cost: p.cost,
    }));
    upsertPurchase({
      id: uid(),
      vendorName,
      status: 'ordered',
      orderDate: new Date().toISOString().slice(0, 10),
      lines,
      note: `Auto-generated from low stock (${items.length} items)`,
    });
    toast.success(`PO created for ${vendorName} · ${items.length} items`);
  };

  const autoPoAll = () => {
    if (!lowByVendor.length) return toast.info('No low-stock items');
    lowByVendor.forEach((g) => autoPoForVendor(g.vendorName, g.items));
  };

  return (
    <div className="space-y-4">
      {lowByVendor.length > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h4 className="font-semibold">Low Stock by Vendor ({lowByVendor.reduce((s, g) => s + g.items.length, 0)} items)</h4>
            </div>
            <Button size="sm" onClick={autoPoAll}>
              <Wand2 className="w-3.5 h-3.5 mr-1" /> Auto PO for All Vendors
            </Button>
          </div>
          <div className="space-y-2">
            {lowByVendor.map((g) => (
              <div key={g.vendorName} className="p-2 rounded bg-background border">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <p className="text-sm font-medium">{g.vendorName} <span className="text-muted-foreground">· {g.items.length} item(s)</span></p>
                  <Button size="sm" variant="outline" onClick={() => autoPoForVendor(g.vendorName, g.items)}>
                    <Wand2 className="w-3 h-3 mr-1" /> Auto PO
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {g.items.map((p) => `${p.name} (${p.stock}/${p.reorderLevel})`).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

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
        <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
          <h4 className="font-semibold">Purchase Orders ({purchases.length})</h4>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCsv(f);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              title="CSV columns: PO Number, Vendor, Order Date, Item, Ordered Qty, Cost"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              {importing ? 'Importing…' : 'Import CSV'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-2"
              disabled={purchases.length === 0}
              onClick={() => { exportPurchasesCsv(purchases); toast.success(`Exported ${purchases.length} POs`); }}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        </div>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No purchase orders. CSV format: <code className="text-xs">PO Number, Vendor, Order Date, Item, Ordered Qty, Received Qty, Cost</code>
          </p>
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
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => printHtml({
                        title: `PO ${p.id}`,
                        bodyHtml: purchaseHtml(p, settings, formatPrice),
                      })}
                      title="Print"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </Button>
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
