// CSV parser + mapper for Items import.
// Handles QuickBooks-style item exports and generic CSVs with
// Name / Category / Price / Cost / Stock / Vendor / Barcode / Description columns.

import { Product } from '@/types';

// RFC4180-ish CSV parser: handles quoted fields, escaped quotes, CRLF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* skip */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim().length));
}

const cleanCategory = (s: string): string => {
  if (!s) return 'Uncategorized';
  // Strip leading numeric account codes + non-word separators (e.g. "00001 � Hardware")
  let out = s.trim().replace(/^\d+\s*[\W_]+\s*/, '').trim();
  // Strip "Income" / ":subcat" suffix common in QuickBooks accounts
  out = out.split(':')[0].trim();
  out = out.replace(/\s+Income$/i, '').trim();
  return out || 'Uncategorized';
};

const num = (s: string): number => {
  const n = parseFloat((s || '').replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const uid = () => Math.random().toString(36).slice(2, 10);

// Find a header column (case-insensitive, accepts aliases)
const findCol = (headers: string[], aliases: string[]): number => {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const i = lower.indexOf(a.toLowerCase());
    if (i !== -1) return i;
  }
  return -1;
};

export interface ImportResult {
  products: Product[];
  newCategories: string[];
  newVendorNames: string[];
  skipped: number;
}

export function mapCsvToProducts(
  rows: string[][],
  opts: {
    existingProducts: Product[];
    existingCategories: string[];
    defaultStock?: number;
  }
): ImportResult {
  if (rows.length < 2) {
    return { products: [], newCategories: [], newVendorNames: [], skipped: 0 };
  }
  const headers = rows[0];
  const cName = findCol(headers, ['Item', 'Name', 'Item Name', 'Product', 'Product Name']);
  const cActive = findCol(headers, ['Active Status', 'Active', 'Status']);
  const cCategory = findCol(headers, ['Category', 'Account', 'Type']);
  const cPrice = findCol(headers, ['Price', 'Sale Price', 'Selling Price', 'Unit Price']);
  const cCost = findCol(headers, ['Cost', 'Purchase Price', 'Unit Cost']);
  const cStock = findCol(headers, ['Stock', 'Quantity On Hand', 'Qty', 'Stock Qty', 'On Hand']);
  const cReorder = findCol(headers, ['Reorder Pt (Min)', 'Reorder Level', 'Reorder', 'Min']);
  const cVendor = findCol(headers, ['Preferred Vendor', 'Vendor', 'Supplier']);
  const cBarcode = findCol(headers, ['Barcode', 'MPN', 'SKU', 'UPC']);
  const cDesc = findCol(headers, ['Description', 'Purchase Description', 'Notes']);

  if (cName === -1) {
    throw new Error('CSV must have an "Item" or "Name" column.');
  }

  const existingNames = new Set(opts.existingProducts.map((p) => p.name.toLowerCase()));
  const existingCats = new Set(opts.existingCategories.map((c) => c.toLowerCase()));
  const newCatsSet = new Set<string>();
  const newVendorsSet = new Set<string>();
  const products: Product[] = [];
  const seenInBatch = new Set<string>();
  let skipped = 0;
  const defaultStock = opts.defaultStock ?? 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[cName] || '').trim();
    if (!name) { skipped++; continue; }

    if (cActive !== -1) {
      const status = (r[cActive] || '').trim().toLowerCase();
      if (status && status !== 'active') { skipped++; continue; }
    }
    const lname = name.toLowerCase();
    if (existingNames.has(lname) || seenInBatch.has(lname)) { skipped++; continue; }
    seenInBatch.add(lname);

    const category = cCategory !== -1 ? cleanCategory(r[cCategory] || '') : 'Uncategorized';
    if (!existingCats.has(category.toLowerCase())) newCatsSet.add(category);

    const vendorName = cVendor !== -1 ? (r[cVendor] || '').trim() : '';
    if (vendorName) newVendorsSet.add(vendorName);

    products.push({
      id: uid(),
      name: name.slice(0, 200),
      category: category.slice(0, 100),
      price: cPrice !== -1 ? num(r[cPrice]) : 0,
      cost: cCost !== -1 ? num(r[cCost]) : 0,
      stock: cStock !== -1 ? num(r[cStock]) : defaultStock,
      reorderLevel: cReorder !== -1 ? num(r[cReorder]) : 0,
      barcode: cBarcode !== -1 ? (r[cBarcode] || '').trim().slice(0, 80) : '',
      location: '',
      description: cDesc !== -1 ? (r[cDesc] || '').trim().slice(0, 2000) : '',
      imageUrl: '',
      // vendorId is resolved by caller after vendors are upserted
    });
  }

  return {
    products,
    newCategories: Array.from(newCatsSet),
    newVendorNames: Array.from(newVendorsSet),
    skipped,
  };
}
