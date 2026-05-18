import { useStore } from '@/store/StoreContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Printer, Receipt, Download } from 'lucide-react';
import { toast } from 'sonner';
import { SortableList } from '@/components/SortableList';
import { printHtml } from '@/lib/print';
import { invoiceHtml, invoiceReceiptHtml } from '@/lib/printTemplates';
import { exportInvoicesCsv } from '@/lib/csvExport';

export function InvoicesView() {
  const { invoices, deleteInvoice, clearInvoices, reorderInvoices, formatPrice, settings } = useStore();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Invoices</p>
          <h3 className="text-lg font-semibold">Saved Sales Invoices</h3>
        </div>
        <div className="flex gap-2">
          {invoices.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { exportInvoicesCsv(invoices); toast.success(`Exported ${invoices.length} invoices`); }}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
            </Button>
          )}
          {invoices.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearInvoices}>Clear All</Button>
          )}
        </div>
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet.</p>
      ) : (
        <SortableList
          className="space-y-3"
          items={invoices}
          getId={(inv) => inv.id}
          onReorder={reorderInvoices}
          renderItem={(inv) => (
            <Card className="p-4 bg-muted/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{inv.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(inv.date).toLocaleString()} · {inv.saleType.toUpperCase()}
                    {inv.phoneNumber && ` · ${inv.phoneNumber}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{formatPrice(inv.total)}</p>
                  <p className="text-xs text-muted-foreground">Paid: {formatPrice(inv.paidAmount)}</p>
                </div>
              </div>
              <div className="mt-3 text-sm">
                {inv.lines.map((l, i) => (
                  <div key={i} className="flex justify-between py-1 border-t first:border-t-0">
                    <span>{l.productName} × {l.qty}</span>
                    <span>{formatPrice(l.price * l.qty)}</span>
                  </div>
                ))}
              </div>
              {inv.note && <p className="text-xs italic mt-2 text-muted-foreground">{inv.note}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => printHtml({
                    title: `Invoice ${inv.id}`,
                    bodyHtml: invoiceReceiptHtml(inv, settings, formatPrice),
                    receipt: true,
                  })}
                >
                  <Receipt className="w-3.5 h-3.5 mr-1" /> Receipt
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => printHtml({
                    title: `Invoice ${inv.id}`,
                    bodyHtml: invoiceHtml(inv, settings, formatPrice),
                  })}
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Print A4
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteInvoice(inv.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              </div>
            </Card>
          )}
        />
      )}
    </Card>
  );
}
