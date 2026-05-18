// Generic CSV export helpers
import { Invoice, Product, PurchaseOrder, LedgerEntry } from '@/types';

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: (string | number | undefined | null)[][]): string {
  const lines = [headers.map(esc).join(',')];
  for (const r of rows) lines.push(r.map(esc).join(','));
  return '\ufeff' + lines.join('\r\n');
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportInvoicesCsv(invoices: Invoice[]) {
  const headers = ['Invoice ID', 'Date', 'Customer', 'Phone', 'Sale Type', 'Item', 'Qty', 'Price', 'Cost', 'Line Total', 'Invoice Total', 'Paid', 'Note'];
  const rows: (string | number)[][] = [];
  invoices.forEach((inv) => {
    if (inv.lines.length === 0) {
      rows.push([inv.id, inv.date, inv.customerName, inv.phoneNumber || '', inv.saleType, '', 0, 0, 0, 0, inv.total, inv.paidAmount, inv.note || '']);
    } else {
      inv.lines.forEach((l) => {
        rows.push([inv.id, inv.date, inv.customerName, inv.phoneNumber || '', inv.saleType, l.productName, l.qty, l.price, l.cost, l.qty * l.price, inv.total, inv.paidAmount, inv.note || '']);
      });
    }
  });
  downloadCsv(`invoices-${stamp()}.csv`, toCsv(headers, rows));
}

export function exportPurchasesCsv(purchases: PurchaseOrder[]) {
  const headers = ['PO Number', 'Vendor', 'Status', 'Order Date', 'Expected Date', 'Item', 'Ordered Qty', 'Received Qty', 'Cost', 'Line Total', 'Note'];
  const rows: (string | number)[][] = [];
  purchases.forEach((p) => {
    if (p.lines.length === 0) {
      rows.push([p.id, p.vendorName, p.status, p.orderDate, p.expectedDate || '', '', 0, 0, 0, 0, p.note || '']);
    } else {
      p.lines.forEach((l) => {
        rows.push([p.id, p.vendorName, p.status, p.orderDate, p.expectedDate || '', l.itemName, l.orderedQty, l.receivedQty, l.cost, l.orderedQty * l.cost, p.note || '']);
      });
    }
  });
  downloadCsv(`purchases-${stamp()}.csv`, toCsv(headers, rows));
}

export function exportLedgerCsv(ledger: LedgerEntry[]) {
  const headers = ['ID', 'Type', 'Name', 'Amount', 'Due Date', 'Note'];
  const rows = ledger.map((l) => [l.id, l.type, l.name, l.amount, l.dueDate || '', l.note || '']);
  downloadCsv(`ledger-${stamp()}.csv`, toCsv(headers, rows));
}

export function exportItemsCsv(products: Product[]) {
  const headers = ['ID', 'Name', 'Category', 'Barcode', 'Price', 'Cost', 'Stock', 'Reorder Level', 'Location', 'Description'];
  const rows = products.map((p) => [p.id, p.name, p.category, p.barcode || '', p.price, p.cost, p.stock, p.reorderLevel, p.location || '', p.description || '']);
  downloadCsv(`items-${stamp()}.csv`, toCsv(headers, rows));
}

interface DupGroup {
  key: string;
  field: 'barcode' | 'name';
  items: Product[];
}

export function findDuplicateItems(products: Product[]): DupGroup[] {
  const byBarcode = new Map<string, Product[]>();
  const byName = new Map<string, Product[]>();
  for (const p of products) {
    const bc = (p.barcode || '').trim().toLowerCase();
    if (bc) {
      if (!byBarcode.has(bc)) byBarcode.set(bc, []);
      byBarcode.get(bc)!.push(p);
    }
    const nm = p.name.trim().toLowerCase();
    if (nm) {
      if (!byName.has(nm)) byName.set(nm, []);
      byName.get(nm)!.push(p);
    }
  }
  const groups: DupGroup[] = [];
  byBarcode.forEach((items, key) => { if (items.length > 1) groups.push({ key, field: 'barcode', items }); });
  byName.forEach((items, key) => { if (items.length > 1) groups.push({ key, field: 'name', items }); });
  return groups;
}

export function exportDuplicateItemsCsv(products: Product[]) {
  const groups = findDuplicateItems(products);
  const headers = ['Duplicate Key', 'Match Field', 'Item ID', 'Name', 'Category', 'Barcode', 'Price', 'Cost', 'Stock'];
  const rows: (string | number)[][] = [];
  groups.forEach((g) => {
    g.items.forEach((p) => {
      rows.push([g.key, g.field, p.id, p.name, p.category, p.barcode || '', p.price, p.cost, p.stock]);
    });
  });
  downloadCsv(`duplicate-items-${stamp()}.csv`, toCsv(headers, rows));
  return groups.length;
}

export interface PnlExportData {
  from: string;
  to: string;
  totalSales: number;
  totalCOGS: number;
  grossProfit: number;
  margin: number;
  totalPurchases: number;
  invoiceCount: number;
  totalReceivable: number;
  totalPayable: number;
  monthlyArr: [string, { sales: number; cost: number }][];
  topItems: { name: string; qty: number; sales: number; cost: number; profit: number }[];
}

export function exportPnlCsv(data: PnlExportData) {
  const lines: string[] = [];
  const push = (h: string[], rows: (string | number)[][]) => { lines.push(toCsv(h, rows).replace(/^\ufeff/, '')); lines.push(''); };
  lines.push('\ufeff' + 'Profit & Loss Report');
  lines.push(`Period,${data.from} to ${data.to}`);
  lines.push('');
  push(['Metric', 'Value'], [
    ['Total Sales', data.totalSales],
    ['COGS', data.totalCOGS],
    ['Gross Profit', data.grossProfit],
    ['Margin %', data.margin.toFixed(2)],
    ['Total Purchases', data.totalPurchases],
    ['Invoice Count', data.invoiceCount],
    ['Total Receivable', data.totalReceivable],
    ['Total Payable', data.totalPayable],
  ]);
  lines.push('Monthly Breakdown');
  push(['Month', 'Sales', 'Cost', 'Profit'], data.monthlyArr.map(([m, v]) => [m, v.sales, v.cost, v.sales - v.cost]));
  lines.push('Top Items by Profit');
  push(['Item', 'Qty', 'Sales', 'Cost', 'Profit'], data.topItems.map((it) => [it.name, it.qty, it.sales, it.cost, it.profit]));
  downloadCsv(`pnl-${data.from}_to_${data.to}.csv`, lines.join('\r\n'));
}
