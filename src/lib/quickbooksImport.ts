// QuickBooks backup importer.
// Supports two common QuickBooks export formats:
//   1. IIF (Intuit Interchange Format) — TAB-delimited text with !HDR rows
//      defining record types like !CUST, !VEND, !INVITEM, !TRNS, !SPL.
//   2. Generic CSV exports of Customers / Vendors / Items / Invoices.
// Note: .qbb / .qbw binary backups cannot be parsed in the browser; users
// must export them as IIF or CSV from QuickBooks first.

import { Product, Customer, Vendor, Invoice, InvoiceLine } from '@/types';
import { parseCsv } from './csvImport';

export interface QbImportResult {
  products: Product[];
  customers: Customer[];
  vendors: Vendor[];
  invoices: Invoice[];
  skipped: number;
  warnings: string[];
}

const uid = () => Math.random().toString(36).slice(2, 11);
const num = (v: any) => {
  const n = parseFloat(String(v ?? '').replace(/[, $]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function parseIif(text: string): QbImportResult {
  const out: QbImportResult = { products: [], customers: [], vendors: [], invoices: [], skipped: 0, warnings: [] };
  const headers = new Map<string, string[]>(); // record type -> header columns
  let currentInvoice: Invoice | null = null;

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const cols = raw.split('\t');
    const tag = cols[0];
    if (tag?.startsWith('!')) {
      headers.set(tag.slice(1), cols.slice(1).map((c) => c.trim().toUpperCase()));
      continue;
    }
    const recType = tag;
    const hdr = headers.get(recType);
    if (!hdr) { out.skipped++; continue; }
    const row: Record<string, string> = {};
    hdr.forEach((h, i) => { row[h] = (cols[i + 1] || '').trim(); });

    switch (recType) {
      case 'CUST':
        if (row.NAME) out.customers.push({ id: uid(), name: row.NAME, phone: row.PHONE1 || row.PHONE || '', note: row.NOTE || '' });
        break;
      case 'VEND':
        if (row.NAME) out.vendors.push({ id: uid(), name: row.NAME, phone: row.PHONE1 || row.PHONE || '', note: row.NOTE || '' });
        break;
      case 'INVITEM': {
        if (!row.NAME) break;
        out.products.push({
          id: uid(),
          name: row.NAME,
          category: row.INVITEMTYPE || 'Imported',
          price: num(row.PRICE || row.SALESPRICE),
          cost: num(row.COST || row.PURCHASECOST),
          stock: num(row.QNTYONHAND),
          reorderLevel: num(row.REORDERPOINT),
          description: row.DESC || row.PURCHASEDESC || '',
          barcode: row.BARCODE || '',
        });
        break;
      }
      case 'TRNS': {
        // Start of a new transaction; only handle INVOICE
        if ((row.TRNSTYPE || '').toUpperCase() !== 'INVOICE') { currentInvoice = null; break; }
        currentInvoice = {
          id: uid(),
          date: row.DATE || new Date().toISOString().slice(0, 10),
          customerName: row.NAME || 'Customer',
          saleType: 'cash',
          paidAmount: num(row.AMOUNT),
          lines: [],
          total: 0,
          totalCost: 0,
          note: row.MEMO || '',
        };
        out.invoices.push(currentInvoice);
        break;
      }
      case 'SPL': {
        if (!currentInvoice) break;
        const qty = Math.abs(num(row.QNTY)) || 1;
        const amount = Math.abs(num(row.AMOUNT));
        const price = qty > 0 ? amount / qty : amount;
        const line: InvoiceLine = {
          productId: uid(),
          productName: row.MEMO || row.ACCNT || 'Item',
          qty,
          price,
          cost: 0,
        };
        currentInvoice.lines.push(line);
        currentInvoice.total += amount;
        break;
      }
      case 'ENDTRNS':
        currentInvoice = null;
        break;
      default:
        out.skipped++;
    }
  }
  return out;
}

function parseCsvAuto(text: string): QbImportResult {
  const out: QbImportResult = { products: [], customers: [], vendors: [], invoices: [], skipped: 0, warnings: [] };
  const rows = parseCsv(text);
  if (rows.length < 2) return out;
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex((h) => h === n || h.includes(n));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iName = idx('item', 'product name', 'name');
  const iPrice = idx('price', 'sales price');
  const iCost = idx('cost', 'purchase cost');
  const iStock = idx('on hand', 'qty', 'quantity');
  const iReorder = idx('reorder', 'reorder point');
  const iBarcode = idx('barcode', 'upc', 'sku');
  const iCategory = idx('type', 'category');
  const iDesc = idx('description', 'desc');
  const iPhone = idx('phone', 'main phone');
  const iCustName = idx('customer', 'company');
  const iVendName = idx('vendor', 'supplier');

  // Heuristic: choose record type
  const lower = headers.join(' ');
  let kind: 'items' | 'customers' | 'vendors' | 'unknown' = 'unknown';
  if (iVendName !== -1 || lower.includes('vendor')) kind = 'vendors';
  else if (iCustName !== -1 || lower.includes('customer')) kind = 'customers';
  else if (iName !== -1 && (iPrice !== -1 || iCost !== -1 || iStock !== -1)) kind = 'items';

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some((c) => (c || '').trim())) continue;
    if (kind === 'items') {
      const name = (r[iName] || '').trim();
      if (!name) { out.skipped++; continue; }
      out.products.push({
        id: uid(),
        name,
        category: iCategory !== -1 ? (r[iCategory] || 'Imported') : 'Imported',
        price: num(r[iPrice]),
        cost: num(r[iCost]),
        stock: num(r[iStock]),
        reorderLevel: num(r[iReorder]),
        barcode: iBarcode !== -1 ? r[iBarcode] : '',
        description: iDesc !== -1 ? r[iDesc] : '',
      });
    } else if (kind === 'customers') {
      const name = (r[iCustName !== -1 ? iCustName : iName] || '').trim();
      if (!name) { out.skipped++; continue; }
      out.customers.push({ id: uid(), name, phone: iPhone !== -1 ? r[iPhone] : '' });
    } else if (kind === 'vendors') {
      const name = (r[iVendName !== -1 ? iVendName : iName] || '').trim();
      if (!name) { out.skipped++; continue; }
      out.vendors.push({ id: uid(), name, phone: iPhone !== -1 ? r[iPhone] : '' });
    } else {
      out.skipped++;
    }
  }
  if (kind === 'unknown') out.warnings.push('Could not detect record type — expected QuickBooks Items / Customers / Vendors CSV.');
  return out;
}

export async function parseQuickBooksFile(file: File): Promise<QbImportResult> {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const text = await file.text();
  if (ext === 'iif' || /^!(HDR|CUST|VEND|INVITEM|TRNS)/m.test(text)) {
    return parseIif(text);
  }
  if (ext === 'csv' || ext === 'txt') {
    return parseCsvAuto(text);
  }
  if (ext === 'qbb' || ext === 'qbw' || ext === 'qbm') {
    throw new Error('Binary QuickBooks backups (.qbb/.qbw) cannot be read in the browser. Please export Items / Customers / Vendors as IIF or CSV from QuickBooks first.');
  }
  // Try IIF as fallback (tab-delimited)
  if (text.includes('\t') && text.includes('!')) return parseIif(text);
  return parseCsvAuto(text);
}
