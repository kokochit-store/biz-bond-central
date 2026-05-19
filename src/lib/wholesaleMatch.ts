// Wholesale price-list parser + matcher.
// Reads CSV / XLSX / PDF, extracts rows with { model, barcode, name, cost },
// matches them against existing Products by barcode → name → description (fuzzy).

import readXlsxFile from 'read-excel-file';
import { Product } from '@/types';
import { parseCsv } from './csvImport';

export interface WholesaleRow {
  rowIndex: number;
  model: string;
  barcode: string;
  name: string;
  cost: number;
  raw: string;
}

export interface MatchedRow {
  row: WholesaleRow;
  product?: Product;
  matchedBy?: 'barcode' | 'name' | 'description';
  costDiff: number;     // wholesale - currentCost
  costPct: number;      // %
}

const norm = (s: string) => (s || '').toString().trim().toLowerCase().replace(/[\s\-_/.]+/g, '');
const numv = (s: any): number => {
  const n = parseFloat(String(s ?? '').replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const COL_ALIASES = {
  model:   ['model', 'model no', 'model#', 'model number', 'item code', 'code', 'sku', 'part no', 'part number', 'mpn', 'ref'],
  barcode: ['barcode', 'upc', 'ean', 'qr', 'qr code'],
  name:    ['name', 'item', 'item name', 'product', 'product name', 'description', 'desc'],
  cost:    ['cost', 'price', 'wholesale', 'wholesale price', 'unit cost', 'unit price', 'buying price', 'purchase price'],
};

function findCol(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => norm(h));
  for (const a of aliases) {
    const idx = lower.indexOf(norm(a));
    if (idx !== -1) return idx;
  }
  // partial contains
  for (let i = 0; i < lower.length; i++) {
    if (aliases.some((a) => lower[i].includes(norm(a)))) return i;
  }
  return -1;
}

function rowsToWholesale(rows: string[][]): WholesaleRow[] {
  if (rows.length < 2) return [];
  // Detect header row (search first 5 rows for one that matches any alias)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const h = rows[i];
    if (findCol(h, COL_ALIASES.cost) !== -1 || findCol(h, COL_ALIASES.model) !== -1 || findCol(h, COL_ALIASES.barcode) !== -1) {
      headerIdx = i; break;
    }
  }
  const headers = rows[headerIdx];
  const cModel = findCol(headers, COL_ALIASES.model);
  const cBarcode = findCol(headers, COL_ALIASES.barcode);
  const cName = findCol(headers, COL_ALIASES.name);
  const cCost = findCol(headers, COL_ALIASES.cost);

  const out: WholesaleRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some((c) => (c || '').trim())) continue;
    const model = cModel !== -1 ? String(r[cModel] || '').trim() : '';
    const barcode = cBarcode !== -1 ? String(r[cBarcode] || '').trim() : '';
    const name = cName !== -1 ? String(r[cName] || '').trim() : '';
    const cost = cCost !== -1 ? numv(r[cCost]) : 0;
    if (!model && !barcode && !name) continue;
    out.push({ rowIndex: i, model, barcode, name, cost, raw: r.join(' | ') });
  }
  return out;
}

export async function parseWholesaleFile(file: File): Promise<WholesaleRow[]> {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    return rowsToWholesale(parseCsv(text));
  }
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || ext === 'ods') {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    let all: string[][] = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
      const rows = rowsToWholesale(aoa as string[][]);
      if (rows.length) return rows; // first sheet with data
      all = all.concat(aoa as string[][]);
    }
    return rowsToWholesale(all);
  }
  if (ext === 'pdf') {
    return parsePdfFile(file);
  }
  throw new Error('Unsupported file type. Use CSV, XLSX, or PDF.');
}

async function parsePdfFile(file: File): Promise<WholesaleRow[]> {
  const pdfjs: any = await import('pdfjs-dist');
  // Worker setup (use bundled worker URL)
  try {
    const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const allRows: string[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const text = await page.getTextContent();
    // Group items by Y coordinate (row), sorted by X
    const lines = new Map<number, { x: number; s: string }[]>();
    for (const it of text.items as any[]) {
      const y = Math.round((it.transform?.[5] ?? 0) * 10) / 10;
      const x = it.transform?.[4] ?? 0;
      const s = (it.str || '').trim();
      if (!s) continue;
      const arr = lines.get(y) || [];
      arr.push({ x, s });
      lines.set(y, arr);
    }
    const sortedYs = Array.from(lines.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const cells = lines.get(y)!.sort((a, b) => a.x - b.x).map((c) => c.s);
      allRows.push(cells);
    }
  }
  return rowsToWholesale(allRows);
}

export function matchWholesaleRows(rows: WholesaleRow[], products: Product[]): MatchedRow[] {
  const byBarcode = new Map<string, Product>();
  const byName = new Map<string, Product>();
  for (const p of products) {
    if (p.barcode) byBarcode.set(norm(p.barcode), p);
    if (p.name) byName.set(norm(p.name), p);
  }
  const productList = products.map((p) => ({ p, key: norm(`${p.name} ${p.description || ''}`) }));

  return rows.map((row) => {
    let product: Product | undefined;
    let matchedBy: MatchedRow['matchedBy'];

    // 1. exact barcode (or model treated as barcode)
    const tokens = [row.barcode, row.model].filter(Boolean).map(norm);
    for (const t of tokens) {
      if (t && byBarcode.has(t)) { product = byBarcode.get(t); matchedBy = 'barcode'; break; }
    }
    // 2. exact name
    if (!product && row.name) {
      const n = norm(row.name);
      if (byName.has(n)) { product = byName.get(n); matchedBy = 'name'; }
    }
    // 3. fuzzy: model/barcode/name token appears inside product name+description
    if (!product) {
      const needles = [row.model, row.barcode, row.name].filter((s) => s && s.length >= 3).map(norm);
      outer: for (const { p, key } of productList) {
        for (const n of needles) {
          if (n && key.includes(n)) { product = p; matchedBy = 'description'; break outer; }
        }
      }
    }

    const curCost = product?.cost ?? 0;
    const diff = row.cost - curCost;
    const pct = curCost > 0 ? (diff / curCost) * 100 : 0;
    return { row, product, matchedBy, costDiff: diff, costPct: pct };
  });
}
