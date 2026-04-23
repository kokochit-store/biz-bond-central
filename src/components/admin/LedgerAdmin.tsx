import { useState } from 'react';
import { useStore, uid } from '@/store/StoreContext';
import { LedgerEntry } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SortableList } from '@/components/SortableList';

const empty: LedgerEntry = { id: '', type: 'receivable', name: '', vendorId: '', amount: 0, dueDate: '', note: '' };

export function LedgerAdmin() {
  const { ledger, vendors, upsertLedger, deleteLedger, reorderLedger, formatPrice } = useStore();
  const [form, setForm] = useState<LedgerEntry>(empty);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return toast.error('Name required');
    upsertLedger({ ...form, id: form.id || uid() });
    toast.success('Entry saved');
    setForm(empty);
  };

  const totalRec = ledger.filter((l) => l.type === 'receivable').reduce((s, l) => s + l.amount, 0);
  const totalPay = ledger.filter((l) => l.type === 'payable').reduce((s, l) => s + l.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Receivable (ရရန်)</p>
          <p className="text-xl font-bold text-success mt-1">{formatPrice(totalRec)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Payable (ပေးရန်)</p>
          <p className="text-xl font-bold text-destructive mt-1">{formatPrice(totalPay)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <h4 className="font-semibold mb-3">{form.id ? 'Edit Ledger Entry' : 'Add Ledger Entry'}</h4>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select className="h-10 px-3 rounded-md border bg-background text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
            <option value="receivable">ရရန် (Receivable)</option>
            <option value="payable">ပေးရန် (Payable)</option>
          </select>
          <Input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className="h-10 px-3 rounded-md border bg-background text-sm" value={form.vendorId || ''} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
            <option value="">No vendor</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <Input type="number" placeholder="Amount *" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
          <Input type="date" value={form.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <Textarea placeholder="Note" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} className="md:col-span-2" rows={2} />
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit">Save Entry</Button>
            <Button type="button" variant="outline" onClick={() => setForm(empty)}>Reset</Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <h4 className="font-semibold mb-3">Entries ({ledger.length})</h4>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ledger entries.</p>
        ) : (
          <SortableList
            className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1"
            items={ledger}
            getId={(l) => l.id}
            onReorder={reorderLedger}
            renderItem={(l) => (
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/40">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={l.type === 'receivable' ? 'default' : 'destructive'}>
                      {l.type === 'receivable' ? 'ရရန်' : 'ပေးရန်'}
                    </Badge>
                    <p className="font-medium text-sm truncate">{l.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatPrice(l.amount)} {l.dueDate && `· Due: ${l.dueDate}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setForm(l)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (confirm('Delete?')) deleteLedger(l.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          />
        )}
      </Card>
    </div>
  );
}
