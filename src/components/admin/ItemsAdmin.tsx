import { useState } from 'react';
import { useStore, uid } from '@/store/StoreContext';
import { Product } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { BarcodeInput } from '@/components/BarcodeInput';
import { SortableList } from '@/components/SortableList';

const empty: Product = {
  id: '', name: '', category: '', price: 0, cost: 0, stock: 0, reorderLevel: 0,
  badge: '', barcode: '', vendorId: '', location: '', imageUrl: '', description: '',
};

export function ItemsAdmin() {
  const { products, vendors, categories, upsertProduct, deleteProduct, setProducts, formatPrice } = useStore();
  const [form, setForm] = useState<Product>(empty);
  const [search, setSearch] = useState('');

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
          <Input placeholder="Image URL" value={form.imageUrl || ''} onChange={(e) => set('imageUrl', e.target.value)} className="md:col-span-2" />
          <Textarea placeholder="Description" value={form.description || ''} onChange={(e) => set('description', e.target.value)} className="md:col-span-2" rows={2} />
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit">{form.id ? 'Update' : 'Save'} Item</Button>
            <Button type="button" variant="outline" onClick={() => setForm(empty)}>Reset</Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h4 className="font-semibold">All Items ({products.length})</h4>
          <Input placeholder="Search items..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
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
