import { useRef, useState, useMemo } from 'react';
import { useStore, uid } from '@/store/StoreContext';
import { Product, PurchaseOrder } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, TrendingUp, TrendingDown, AlertCircle, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseWholesaleFile, matchWholesaleRows, type MatchedRow } from '@/lib/wholesaleMatch';

interface RowDecision {
  selected: boolean;
  newCost: number;
  newPrice: number;
}

export function WholesaleMatchAdmin() {
  const { products, vendors, upsertProduct, upsertPurchase, formatPrice } = useStore();
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<MatchedRow[]>([]);
  const [decisions, setDecisions] = useState<Record<number, RowDecision>>({});
  const [vendorName, setVendorName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const rows = await parseWholesaleFile(file);
      if (!rows.length) {
        toast.error('No rows detected. Check that the file has Model/Barcode/Name/Cost columns.');
        return;
      }
      const m = matchWholesaleRows(rows, products);
      setMatches(m);
      setFileName(file.name);
      // initial decisions: select rows where matched AND cost changed
      const init: Record<number, RowDecision> = {};
      m.forEach((mr, idx) => {
        const cur = mr.product;
        const margin = cur && cur.cost > 0 ? cur.price / cur.cost : 1.3;
        const newCost = mr.row.cost || cur?.cost || 0;
        const newPrice = cur ? Math.round(newCost * margin) : Math.round(newCost * 1.3);
        init[idx] = {
          selected: !!cur && mr.row.cost > 0 && Math.abs(mr.costDiff) > 0.0001,
          newCost,
          newPrice,
        };
      });
      setDecisions(init);
      const matched = m.filter((x) => x.product).length;
      toast.success(`Parsed ${rows.length} rows · matched ${matched} / unmatched ${rows.length - matched}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const updateDecision = (idx: number, patch: Partial<RowDecision>) => {
    setDecisions((d) => ({ ...d, [idx]: { ...d[idx], ...patch } }));
  };

  const selectedRows = useMemo(
    () => matches.map((m, i) => ({ m, i, d: decisions[i] })).filter((x) => x.d?.selected && x.m.product),
    [matches, decisions]
  );

  const applyChanges = () => {
    if (!selectedRows.length) return toast.error('No rows selected');
    let count = 0;
    for (const { m, d } of selectedRows) {
      if (!m.product) continue;
      upsertProduct({ ...m.product, cost: d.newCost, price: d.newPrice });
      count++;
    }
    toast.success(`Updated ${count} items`);
  };

  const lowStockItems = useMemo(() => {
    return matches
      .map((m, i) => ({ m, i, d: decisions[i] }))
      .filter(({ m }) => m.product && m.product.stock < (m.product.reorderLevel || 0));
  }, [matches, decisions]);

  const generatePO = () => {
    if (!lowStockItems.length) return toast.error('No low-stock matched items');
    const vName = vendorName.trim() || lowStockItems[0].m.row.name || 'Wholesale Vendor';
    const po: PurchaseOrder = {
      id: uid(),
      vendorName: vName.slice(0, 200),
      status: 'ordered',
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDate: '',
      lines: lowStockItems.map(({ m, d }) => {
        const p = m.product!;
        const qty = Math.max(1, (p.reorderLevel || 1) * 2 - p.stock);
        return {
          itemName: p.name,
          orderedQty: qty,
          receivedQty: 0,
          cost: d?.newCost ?? p.cost,
        };
      }),
      note: `Auto-generated from ${fileName}`,
    };
    upsertPurchase(po);
    toast.success(`Created PO with ${po.lines.length} low-stock items`);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold">Wholesale Price Match</h3>
            <p className="text-xs text-muted-foreground">
              CSV / Excel / PDF တင်ပြီး model/barcode/name အလိုက် တိုက်ဆိုင်စစ်၊ cost &amp; sale price ပြောင်းပါ။
              Stock နည်းနေသော items များ Purchase Order အလိုအလျောက် ထုတ်ပါ။
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls,.xlsm,.ods,.pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="w-4 h-4" /> {busy ? 'Reading…' : 'Upload Wholesale File'}
          </Button>
          {fileName && (
            <>
              <Badge variant="secondary">{fileName}</Badge>
              <Button variant="ghost" size="sm" onClick={() => { setMatches([]); setDecisions({}); setFileName(''); }}>
                <Trash2 className="w-4 h-4" /> Clear
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Recognized columns: <code>Model / SKU / Item Code</code>, <code>Barcode / UPC</code>, <code>Name / Description</code>, <code>Cost / Wholesale Price</code>.
        </p>
      </Card>

      {matches.length > 0 && (
        <>
          <Card className="p-3 flex flex-wrap gap-3 items-center justify-between">
            <div className="text-sm">
              <strong>{matches.filter((m) => m.product).length}</strong> matched ·{' '}
              <strong>{matches.filter((m) => !m.product).length}</strong> unmatched ·{' '}
              <strong>{selectedRows.length}</strong> selected
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                list="vendor-list"
                placeholder="PO Vendor name"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-44 h-9"
              />
              <datalist id="vendor-list">
                {vendors.map((v) => <option key={v.id} value={v.name} />)}
              </datalist>
              <Button variant="outline" onClick={generatePO} disabled={!lowStockItems.length}>
                <ShoppingCart className="w-4 h-4" /> Auto PO ({lowStockItems.length})
              </Button>
              <Button onClick={applyChanges} disabled={!selectedRows.length}>
                Apply Price Changes ({selectedRows.length})
              </Button>
            </div>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-left">Wholesale Row</th>
                  <th className="p-2 text-left">Matched Item</th>
                  <th className="p-2 text-right">Cur. Cost</th>
                  <th className="p-2 text-right">New Cost</th>
                  <th className="p-2 text-right">Δ</th>
                  <th className="p-2 text-right">Cur. Sale</th>
                  <th className="p-2 text-right">New Sale</th>
                  <th className="p-2 text-center">Stock</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, idx) => {
                  const d = decisions[idx];
                  if (!d) return null;
                  const p = m.product;
                  const isLow = p && p.stock < (p.reorderLevel || 0);
                  return (
                    <tr key={idx} className="border-t hover:bg-muted/30">
                      <td className="p-2 align-top">
                        <Checkbox
                          checked={d.selected}
                          disabled={!p}
                          onCheckedChange={(v) => updateDecision(idx, { selected: !!v })}
                        />
                      </td>
                      <td className="p-2 align-top">
                        <div className="font-medium">{m.row.name || m.row.model || m.row.barcode || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.row.model && <>Model: {m.row.model} · </>}
                          {m.row.barcode && <>BC: {m.row.barcode} · </>}
                          Cost: {formatPrice(m.row.cost)}
                        </div>
                      </td>
                      <td className="p-2 align-top">
                        {p ? (
                          <>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-[10px]">{m.matchedBy}</Badge> · {p.category}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> No match
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right tabular-nums align-top">{p ? formatPrice(p.cost) : '—'}</td>
                      <td className="p-2 align-top">
                        <Input
                          type="number"
                          value={d.newCost}
                          onChange={(e) => updateDecision(idx, { newCost: parseFloat(e.target.value) || 0 })}
                          className="h-8 w-24 text-right tabular-nums"
                          disabled={!p}
                        />
                      </td>
                      <td className="p-2 text-right tabular-nums align-top">
                        {p && Math.abs(m.costDiff) > 0.0001 && (
                          <span className={`inline-flex items-center gap-0.5 text-xs ${m.costDiff > 0 ? 'text-destructive' : 'text-green-600'}`}>
                            {m.costDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {m.costPct.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right tabular-nums align-top">{p ? formatPrice(p.price) : '—'}</td>
                      <td className="p-2 align-top">
                        <Input
                          type="number"
                          value={d.newPrice}
                          onChange={(e) => updateDecision(idx, { newPrice: parseFloat(e.target.value) || 0 })}
                          className="h-8 w-24 text-right tabular-nums"
                          disabled={!p}
                        />
                      </td>
                      <td className="p-2 text-center align-top">
                        {p ? (
                          <Badge variant={isLow ? 'destructive' : 'secondary'} className="text-[10px]">
                            {p.stock} / {p.reorderLevel || 0}
                          </Badge>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
