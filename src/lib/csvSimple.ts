// Generic CSV import for simple Name/Phone/Note tables (Customers, Vendors)
// and a multi-row Purchase Order CSV importer.

import { Customer, Vendor, PurchaseOrder, PurchaseLine } from '@/types';
import { parseCsv } from './csvImport';

const uid = () => Math.random().toString(36).slice(2, 10);

const findCol = (headers: string[], aliases: string[]): number => {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const i = lower.indexOf(a.toLowerCase());
    if (i !== -1) return i;
  }
  return -1;
};

export interface SimpleImportResult<T> {
  records: T[];
  skipped: number;
}

export function mapCsvToCustomers(
  text: string,
  existing: Customer[],
): SimpleImportResult<Customer> {
  const rows = parseCsv(text);
  if (rows.length < 2) return { records: [], skipped: 0 };
  const headers = rows[0];
  const cName = findCol(headers, ['Name', 'Customer', 'Customer Name', 'Full Name']);
  const cPhone = findCol(headers, ['Phone', 'Mobile', 'Contact', 'Phone Number']);
  const cNote = findCol(headers, ['Note', 'Notes', 'Address', 'Remark', 'Description']);
  if (cName === -1) throw new Error('CSV must have a "Name" column.');

  const seen = new Set(existing.map((c) => c.name.toLowerCase()));
  const records: Customer[] = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[cName] || '').trim();
    if (!name) { skipped++; continue; }
    const lname = name.toLowerCase();
    if (seen.has(lname)) { skipped++; continue; }
    seen.add(lname);
    records.push({
      id: uid(),
      name: name.slice(0, 200),
      phone: cPhone !== -1 ? (r[cPhone] || '').trim().slice(0, 40) : '',
      note: cNote !== -1 ? (r[cNote] || '').trim().slice(0, 1000) : '',
    });
  }
  return { records, skipped };
}

export function mapCsvToVendors(
  text: string,
  existing: Vendor[],
): SimpleImportResult<Vendor> {
  const rows = parseCsv(text);
  if (rows.length < 2) return { records: [], skipped: 0 };
  const headers = rows[0];
  const cName = findCol(headers, ['Name', 'Vendor', 'Vendor Name', 'Supplier', 'Supplier Name']);
  const cPhone = findCol(headers, ['Phone', 'Mobile', 'Contact', 'Phone Number']);
  const cNote = findCol(headers, ['Note', 'Notes', 'Address', 'Remark', 'Description']);
  if (cName === -1) throw new Error('CSV must have a "Name" column.');

  const seen = new Set(existing.map((v) => v.name.toLowerCase()));
  const records: Vendor[] = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[cName] || '').trim();
    if (!name) { skipped++; continue; }
    const lname = name.toLowerCase();
    if (seen.has(lname)) { skipped++; continue; }
    seen.add(lname);
    records.push({
      id: uid(),
      name: name.slice(0, 200),
      phone: cPhone !== -1 ? (r[cPhone] || '').trim().slice(0, 40) : '',
      note: cNote !== -1 ? (r[cNote] || '').trim().slice(0, 1000) : '',
    });
  }
  return { records, skipped };
}

const num = (s: string): number => {
  const n = parseFloat((s || '').replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Purchase Orders CSV — one row per line item, grouped by PO Number.
// Expected columns: PO Number, Vendor, Order Date, Expected Date, Status, Item, Ordered Qty, Received Qty, Cost, Note
export function mapCsvToPurchases(text: string): SimpleImportResult<PurchaseOrder> {
  const rows = parseCsv(text);
  if (rows.length < 2) return { records: [], skipped: 0 };
  const h = rows[0];
  const cPo = findCol(h, ['PO Number', 'PO', 'Order Number', 'PO #']);
  const cVendor = findCol(h, ['Vendor', 'Supplier', 'Vendor Name']);
  const cOrderDate = findCol(h, ['Order Date', 'Date']);
  const cExpected = findCol(h, ['Expected Date', 'Expected', 'Delivery Date']);
  const cStatus = findCol(h, ['Status']);
  const cItem = findCol(h, ['Item', 'Item Name', 'Product']);
  const cOrd = findCol(h, ['Ordered Qty', 'Order Qty', 'Qty', 'Quantity']);
  const cRecv = findCol(h, ['Received Qty', 'Recv Qty', 'Received']);
  const cCost = findCol(h, ['Cost', 'Unit Cost', 'Price']);
  const cNote = findCol(h, ['Note', 'Notes', 'Remark']);

  if (cVendor === -1 || cItem === -1) {
    throw new Error('CSV must have at least "Vendor" and "Item" columns.');
  }

  const groups = new Map<string, PurchaseOrder>();
  let skipped = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const vendor = (r[cVendor] || '').trim();
    const item = (r[cItem] || '').trim();
    if (!vendor || !item) { skipped++; continue; }

    // Group key: explicit PO number, or vendor+date if not provided.
    const orderDate = cOrderDate !== -1 ? (r[cOrderDate] || today).trim() : today;
    const key = cPo !== -1 && (r[cPo] || '').trim()
      ? (r[cPo] || '').trim()
      : `${vendor}__${orderDate}`;

    let po = groups.get(key);
    if (!po) {
      const status = cStatus !== -1 ? (r[cStatus] || '').trim().toLowerCase() : 'ordered';
      po = {
        id: uid(),
        vendorName: vendor.slice(0, 200),
        status: (['ordered', 'partial', 'received'].includes(status) ? status : 'ordered') as PurchaseOrder['status'],
        orderDate,
        expectedDate: cExpected !== -1 ? (r[cExpected] || '').trim() : '',
        lines: [],
        note: cNote !== -1 ? (r[cNote] || '').trim().slice(0, 1000) : '',
      };
      groups.set(key, po);
    }

    const line: PurchaseLine = {
      itemName: item.slice(0, 200),
      orderedQty: cOrd !== -1 ? num(r[cOrd]) : 0,
      receivedQty: cRecv !== -1 ? num(r[cRecv]) : 0,
      cost: cCost !== -1 ? num(r[cCost]) : 0,
    };
    po.lines.push(line);
  }

  return { records: Array.from(groups.values()), skipped };
}
