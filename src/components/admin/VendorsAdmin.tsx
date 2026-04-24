import { useRef, useState } from 'react';
import { useStore, uid } from '@/store/StoreContext';
import { Vendor } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { SortableList } from '@/components/SortableList';
import { mapCsvToVendors } from '@/lib/csvSimple';

const empty: Vendor = { id: '', name: '', phone: '', note: '' };

export function VendorsAdmin() {
  const { vendors, upsertVendor, deleteVendor, reorderVendors } = useStore();
  const [form, setForm] = useState<Vendor>(empty);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return toast.error('Name required');
    upsertVendor({ ...form, id: form.id || uid() });
    toast.success(form.id ? 'Vendor updated' : 'Vendor added');
    setForm(empty);
  };

  const handleCsv = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const result = mapCsvToVendors(text, vendors);
      if (!result.records.length) {
        toast.error('No new vendors found');
        return;
      }
      result.records.forEach((v) => upsertVendor(v));
      toast.success(`Imported ${result.records.length} vendors${result.skipped ? ` · ${result.skipped} skipped` : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h4 className="font-semibold mb-3">{form.id ? 'Edit Vendor' : 'Add Vendor'}</h4>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Supplier Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Textarea placeholder="Note" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} className="md:col-span-2" rows={2} />
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit">Save Vendor</Button>
            <Button type="button" variant="outline" onClick={() => setForm(empty)}>Reset</Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
          <h4 className="font-semibold">Vendors ({vendors.length})</h4>
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
              title="CSV columns: Name, Phone, Note"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              {importing ? 'Importing…' : 'Import CSV'}
            </Button>
          </div>
        </div>
        <SortableList
          className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1"
          items={vendors}
          getId={(v) => v.id}
          onReorder={reorderVendors}
          renderItem={(v) => (
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/40">
              <div className="min-w-0">
                <p className="font-medium text-sm">{v.name}</p>
                <p className="text-xs text-muted-foreground">{v.phone} {v.note && `· ${v.note}`}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setForm(v)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (confirm('Delete?')) deleteVendor(v.id); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        />
      </Card>
    </div>
  );
}
