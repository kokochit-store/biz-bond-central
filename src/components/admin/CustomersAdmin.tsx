import { useState } from 'react';
import { useStore, uid } from '@/store/StoreContext';
import { Customer } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SortableList } from '@/components/SortableList';

const empty: Customer = { id: '', name: '', phone: '', note: '' };

export function CustomersAdmin() {
  const { customers, upsertCustomer, deleteCustomer, reorderCustomers } = useStore();
  const [form, setForm] = useState<Customer>(empty);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return toast.error('Name required');
    upsertCustomer({ ...form, id: form.id || uid() });
    toast.success(form.id ? 'Customer updated' : 'Customer added');
    setForm(empty);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h4 className="font-semibold mb-3">{form.id ? 'Edit Customer' : 'Add Customer'}</h4>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Customer Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Textarea placeholder="Address / Note" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} className="md:col-span-2" rows={2} />
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit">Save Customer</Button>
            <Button type="button" variant="outline" onClick={() => setForm(empty)}>Reset</Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <h4 className="font-semibold mb-3">Customers ({customers.length})</h4>
        {customers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No customers yet.</p>
        ) : (
          <SortableList
            className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1"
            items={customers}
            getId={(c) => c.id}
            onReorder={reorderCustomers}
            renderItem={(c) => (
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/40">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone} {c.note && `· ${c.note}`}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setForm(c)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (confirm('Delete?')) deleteCustomer(c.id); }}>
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
