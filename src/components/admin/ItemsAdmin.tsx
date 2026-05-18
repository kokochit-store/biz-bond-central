import { useRef, useState } from 'react';
import { useStore, uid } from '@/store/StoreContext';
import { Product, Vendor } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2, Upload, Printer, Download, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { BarcodeInput } from '@/components/BarcodeInput';
import { SortableList } from '@/components/SortableList';
import { ImageUpload } from '@/components/ImageUpload';
import { parseCsv, mapCsvToProducts } from '@/lib/csvImport';
import { printHtml } from '@/lib/print';
import { itemsHtml } from '@/lib/printTemplates';
import { exportItemsCsv, exportDuplicateItemsCsv, findDuplicateItems } from '@/lib/csvExport';

const empty: Product = {
  id: '', name: '', category: '', price: 0, cost: 0, stock: 0, reorderLevel: 0,
  badge: '', barcode: '', vendorId: '', location: '', imageUrl: '', description: '',
};

export function ItemsAdmin() {
  const {
    products, vendors, categories, settings,
    upsertProduct, deleteProduct, setProducts,
    setCategories, upsertVendor,
    formatPrice,
  } = useStore();
  const [form, setForm] = useState<Product>(empty);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCsv = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const result = mapCsvToProducts(rows, {
        existingProducts: products,
        existingCategories: categories,
        defaultStock: 10,
      });
      if (!result.products.length) {
        toast.error('No new items found in CSV');
        return;
      }

      // Add new vendors first
      const vendorByName = new Map(vendors.map((v) => [v.name.toLowerCase(), v]));
      for (const name of result.newVendorNames) {
        if (!vendorByName.has(name.toLowerCase())) {
          const v: Vendor = { id: uid(), name };
          vendorByName.set(name.toLowerCase(), v);
          upsertVendor(v);
        }
      }

      // Resolve vendorId per product by re-walking source rows in order
      const headers = rows[0];
      const vIdx = headers.findIndex((h) =>
        ['preferred vendor', 'vendor', 'supplier'].includes(h.trim().toLowerCase())
      );
      const finalProducts = [...result.products];
      if (vIdx !== -1) {
        const nameCol = headers.findIndex((h) =>
          ['item', 'name', 'item name', 'product', 'product name'].includes(h.trim().toLowerCase())
        );
        const activeCol = headers.findIndex((h) =>
          ['active status', 'active', 'status'].includes(h.trim().toLowerCase())
        );
        const existingNames = new Set(products.map((p) => p.name.toLowerCase()));
        const seen = new Set<string>();
        let pi = 0;
        for (let i = 1; i < rows.length && pi < finalProducts.length; i++) {
          const r = rows[i];
          const nm = (r[nameCol] || '').trim();
          if (!nm) continue;
          if (activeCol !== -1) {
            const st = (r[activeCol] || '').trim().toLowerCase();
            if (st && st !== 'active') continue;
          }
          const lname = nm.toLowerCase();
          if (existingNames.has(lname) || seen.has(lname)) continue;
          seen.add(lname);
          const vname = (r[vIdx] || '').trim().toLowerCase();
          const vid = vname ? vendorByName.get(vname)?.id : undefined;
          finalProducts[pi] = { ...finalProducts[pi], vendorId: vid };
          pi++;
        }
      }

      // Add new categories
      const catSet = new Set(categories);
      result.newCategories.forEach((c) => catSet.add(c));
      setCategories(Array.from(catSet));

      // Bulk add products
      setProducts([...products, ...finalProducts]);

      toast.success(
        `Imported ${finalProducts.length} items` +
          (result.newVendorNames.length ? ` · ${result.newVendorNames.length} vendors` : '') +
          (result.newCategories.length ? ` · ${result.newCategories.length} categories` : '') +
          (result.skipped ? ` · ${result.skipped} skipped` : '')
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setImporting(false);
    }
  };


  const set = <K extends keyof Product>(k: K, v: Product[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category) {
      toast.error('Name and category required');
      return;
    }
    upsertProduct({ ...form, id: form.id || uid() });
    toast.success(form.id ? 'Item updated' : 'Item added');
    setForm(empty);
  };

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h4 className="font-semibold mb-3">{form.id ? 'Edit Item' : 'Add New Item'}</h4>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Item Name *" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          <select
            className="h-10 px-3 rounded-md border bg-background text-sm"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            required
          >
            <option value="">Select category *</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input type="number" placeholder="Sale Price" value={form.price || ''} onChange={(e) => set('price', Number(e.target.value))} />
          <Input type="number" placeholder="Cost" value={form.cost || ''} onChange={(e) => set('cost', Number(e.target.value))} />
          <Input type="number" placeholder="Stock Qty" value={form.stock || ''} onChange={(e) => set('stock', Number(e.target.value))} />
          <Input type="number" placeholder="Reorder Level" value={form.reorderLevel || ''} onChange={(e) => set('reorderLevel', Number(e.target.value))} />
          <Input placeholder="Badge (e.g. DR)" maxLength={3} value={form.badge || ''} onChange={(e) => set('badge', e.target.value)} />
          <BarcodeInput value={form.barcode || ''} onChange={(v) => set('barcode', v)} placeholder="Barcode" />
          <select
            className="h-10 px-3 rounded-md border bg-background text-sm"
            value={form.vendorId || ''}
            onChange={(e) => set('vendorId', e.target.value)}
          >
            <option value="">No supplier</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <Input placeholder="Location (Shelf A-3)" value={form.location || ''} onChange={(e) => set('location', e.target.value)} />
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs text-muted-foreground">Item Photo</label>
            <ImageUpload value={form.imageUrl || ''} onChange={(v) => set('imageUrl', v)} label="ပစ္စည်းပုံ ထည့်ရန်" aspect="square" />
          </div>
          <Textarea placeholder="Description" value={form.description || ''} onChange={(e) => set('description', e.target.value)} className="md:col-span-2" rows={2} />
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit">{form.id ? 'Update' : 'Save'} Item</Button>
            <Button type="button" variant="outline" onClick={() => setForm(empty)}>Reset</Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
          <h4 className="font-semibold">All Items ({products.length})</h4>
          <div className="flex flex-wrap items-center gap-2">
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
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              {importing ? 'Importing…' : 'Import CSV'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { exportItemsCsv(products); toast.success(`Exported ${products.length} items`); }}
              disabled={products.length === 0}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const groups = findDuplicateItems(products);
                if (!groups.length) return toast.info('No duplicates found');
                exportDuplicateItemsCsv(products);
                toast.success(`Exported ${groups.length} duplicate groups`);
              }}
              disabled={products.length === 0}
              title="Export items with same barcode or same name"
            >
              <Copy className="w-3.5 h-3.5 mr-1" /> Duplicates CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => printHtml({
                title: 'Items List',
                bodyHtml: itemsHtml(filtered.length ? filtered : products, settings, formatPrice),
              })}
            >
              <Printer className="w-3.5 h-3.5 mr-1" /> Print
            </Button>
            <Input
              placeholder="Search items..."
              className="max-w-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {search ? (
          <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
            {filtered.map((p) => (
              <ItemRow key={p.id} p={p} formatPrice={formatPrice} onEdit={setForm} onDelete={deleteProduct} />
            ))}
          </div>
        ) : (
          <SortableList
            className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1"
            items={products}
            getId={(p) => p.id}
            onReorder={setProducts}
            renderItem={(p) => (
              <ItemRow p={p} formatPrice={formatPrice} onEdit={setForm} onDelete={deleteProduct} />
            )}
          />
        )}
      </Card>
    </div>
  );
}

function ItemRow({
  p,
  formatPrice,
  onEdit,
  onDelete,
}: {
  p: Product;
  formatPrice: (n: number) => string;
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 hover:bg-muted">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{p.name}</p>
        <p className="text-xs text-muted-foreground">
          {p.category} · Stock: {p.stock} · {formatPrice(p.price)}
          {p.barcode ? ` · ⌗ ${p.barcode}` : ''}
        </p>
      </div>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(p)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive"
          onClick={() => {
            if (confirm(`Delete ${p.name}?`)) {
              onDelete(p.id);
              toast.success('Item deleted');
            }
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
