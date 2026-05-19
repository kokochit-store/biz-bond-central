import { useRef, useState } from 'react';
import { useStore } from '@/store/StoreContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { parseQuickBooksFile, QbImportResult } from '@/lib/quickbooksImport';

export function QuickBooksAdmin() {
  const { upsertProduct, upsertCustomer, upsertVendor, products, customers, vendors } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<QbImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFile = async (f: File) => {
    setBusy(true);
    setFileName(f.name);
    try {
      const result = await parseQuickBooksFile(f);
      setPreview(result);
      const total = result.products.length + result.customers.length + result.vendors.length + result.invoices.length;
      if (total === 0) toast.error('No records found');
      else toast.success(`Parsed ${total} records`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse file');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const applyImport = () => {
    if (!preview) return;
    const existingItemNames = new Set(products.map((p) => p.name.toLowerCase()));
    const existingCustNames = new Set(customers.map((c) => c.name.toLowerCase()));
    const existingVendNames = new Set(vendors.map((v) => v.name.toLowerCase()));

    let imported = 0;
    for (const p of preview.products) {
      if (existingItemNames.has(p.name.toLowerCase())) continue;
      upsertProduct(p); imported++;
    }
    for (const c of preview.customers) {
      if (existingCustNames.has(c.name.toLowerCase())) continue;
      upsertCustomer(c); imported++;
    }
    for (const v of preview.vendors) {
      if (existingVendNames.has(v.name.toLowerCase())) continue;
      upsertVendor(v); imported++;
    }
    toast.success(`Imported ${imported} new records (duplicates skipped)`);
    setPreview(null);
    setFileName('');
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <FileDown className="w-5 h-5 text-primary mt-1" />
          <div>
            <h4 className="font-semibold">Import QuickBooks Backup Data</h4>
            <p className="text-xs text-muted-foreground">
              Upload a <strong>.IIF</strong> file (Intuit Interchange) or a CSV export of <em>Items / Customers / Vendors / Invoices</em>.
              Binary <code>.qbb/.qbw</code> backups are not supported — export them as IIF/CSV from QuickBooks first
              (<em>File → Utilities → Export → Lists to IIF Files</em>).
            </p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".iif,.csv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="w-4 h-4 mr-1" /> {busy ? 'Reading…' : 'Choose QuickBooks File'}
          </Button>
          {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
        </div>
      </Card>

      {preview && (
        <Card className="p-4">
          <h4 className="font-semibold mb-3">Preview</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Items" value={preview.products.length} />
            <Stat label="Customers" value={preview.customers.length} />
            <Stat label="Vendors" value={preview.vendors.length} />
            <Stat label="Invoices" value={preview.invoices.length} />
          </div>
          {preview.skipped > 0 && (
            <p className="text-xs text-muted-foreground mb-2">
              <AlertTriangle className="w-3 h-3 inline mr-1" /> {preview.skipped} rows skipped (unsupported record types).
            </p>
          )}
          {preview.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600 mb-1"><AlertTriangle className="w-3 h-3 inline mr-1" />{w}</p>
          ))}

          {preview.products.length > 0 && (
            <details className="mb-2">
              <summary className="text-sm cursor-pointer font-medium">Items ({preview.products.length})</summary>
              <div className="text-xs mt-2 max-h-40 overflow-auto border rounded p-2 bg-muted/30">
                {preview.products.slice(0, 50).map((p, i) => (
                  <div key={i}>{p.name} · cost {p.cost} · price {p.price} · stock {p.stock}</div>
                ))}
                {preview.products.length > 50 && <div className="text-muted-foreground">…and {preview.products.length - 50} more</div>}
              </div>
            </details>
          )}
          {preview.customers.length > 0 && (
            <details className="mb-2">
              <summary className="text-sm cursor-pointer font-medium">Customers ({preview.customers.length})</summary>
              <div className="text-xs mt-2 max-h-40 overflow-auto border rounded p-2 bg-muted/30">
                {preview.customers.slice(0, 50).map((c, i) => <div key={i}>{c.name} · {c.phone}</div>)}
              </div>
            </details>
          )}
          {preview.vendors.length > 0 && (
            <details className="mb-2">
              <summary className="text-sm cursor-pointer font-medium">Vendors ({preview.vendors.length})</summary>
              <div className="text-xs mt-2 max-h-40 overflow-auto border rounded p-2 bg-muted/30">
                {preview.vendors.slice(0, 50).map((v, i) => <div key={i}>{v.name} · {v.phone}</div>)}
              </div>
            </details>
          )}

          <div className="flex gap-2 mt-3">
            <Button onClick={applyImport}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Apply Import
            </Button>
            <Button variant="outline" onClick={() => { setPreview(null); setFileName(''); }}>Cancel</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Duplicates (by name) are skipped automatically. Invoices are previewed but not yet auto-imported — re-save them from the Sales tab if needed.
          </p>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg bg-muted/40 border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
