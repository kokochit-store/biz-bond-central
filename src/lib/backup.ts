import { Product, Customer, Vendor, PurchaseOrder, LedgerEntry, Invoice, StoreSettings } from '@/types';
import { AppPreferences, DEFAULT_PREFS, DEFAULT_THEME, ThemeSettings } from '@/store/customization';

export interface BackupData {
  products: Product[];
  customers: Customer[];
  vendors: Vendor[];
  purchases: PurchaseOrder[];
  ledger: LedgerEntry[];
  invoices: Invoice[];
  settings: StoreSettings;
  theme: ThemeSettings;
  prefs: AppPreferences;
  categories: string[];
  exportedAt?: string;
  version?: number;
}

export interface BackupParseResult {
  ok: boolean;
  data?: Partial<BackupData>;
  error?: string;
  issues: { path: string; message: string }[];
  notices: { path: string; message: string }[];
  meta: { exportedAt?: string; version?: string; format: string; bytes: number; imageCount: number; embeddedImageCount: number };
}

const arr = (value: unknown) => Array.isArray(value) ? value : undefined;
const obj = (value: unknown): Record<string, any> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : undefined;
const text = (value: unknown, fallback = '') => value == null ? fallback : String(value);
const maybeText = (value: unknown) => value == null ? undefined : String(value);
const num = (value: unknown, fallback = 0) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const imageFields = ['imageUrl', 'heroImageUrl', 'logoImageUrl', 'photoUrl', 'avatarUrl', 'picture', 'image'] as const;

function countImages(value: unknown) {
  let imageCount = 0;
  let embeddedImageCount = 0;
  const walk = (node: unknown, key = '') => {
    if (typeof node === 'string') {
      if (imageFields.includes(key as any) || node.startsWith('data:image/')) {
        imageCount += 1;
        if (node.startsWith('data:image/')) embeddedImageCount += 1;
      }
      return;
    }
    if (Array.isArray(node)) return node.forEach((item) => walk(item));
    const record = obj(node);
    if (record) Object.entries(record).forEach(([k, v]) => walk(v, k));
  };
  walk(value);
  return { imageCount, embeddedImageCount };
}

function normalizeProduct(item: unknown, index: number, notices: BackupParseResult['notices']): Product | null {
  const p = obj(item);
  if (!p) return null;
  if (!p.id) notices.push({ path: `products.${index}.id`, message: 'Missing id ကို အသစ်ထည့်ပေးထားပါတယ်' });
  if (!p.name) notices.push({ path: `products.${index}.name`, message: 'Missing name ကို Untitled item အဖြစ် ထည့်ထားပါတယ်' });
  return {
    ...p,
    id: text(p.id, `product-${Date.now()}-${index}`),
    name: text(p.name, `Untitled item ${index + 1}`),
    category: text(p.category, 'Uncategorized'),
    price: num(p.price),
    cost: num(p.cost),
    stock: num(p.stock),
    reorderLevel: num(p.reorderLevel),
    badge: maybeText(p.badge),
    barcode: maybeText(p.barcode),
    vendorId: maybeText(p.vendorId),
    location: maybeText(p.location),
    description: maybeText(p.description),
    imageUrl: maybeText(p.imageUrl),
  };
}

function normalizeNamed<T extends Customer | Vendor>(item: unknown, index: number, prefix: string, notices: BackupParseResult['notices']): T | null {
  const c = obj(item);
  if (!c) return null;
  if (!c.id) notices.push({ path: `${prefix}.${index}.id`, message: 'Missing id ကို အသစ်ထည့်ပေးထားပါတယ်' });
  if (!c.name) notices.push({ path: `${prefix}.${index}.name`, message: 'Missing name ကို Unknown အဖြစ် ထည့်ထားပါတယ်' });
  return {
    ...c,
    id: text(c.id, `${prefix}-${Date.now()}-${index}`),
    name: text(c.name, `Unknown ${index + 1}`),
    phone: maybeText(c.phone),
    note: maybeText(c.note),
  } as T;
}

function normalizeWithId<T>(item: unknown, index: number, prefix: string, notices: BackupParseResult['notices']): T | null {
  const value = obj(item);
  if (!value) return null;
  if (!value.id) notices.push({ path: `${prefix}.${index}.id`, message: 'Missing id ကို အသစ်ထည့်ပေးထားပါတယ်' });
  return { ...value, id: text(value.id, `${prefix}-${Date.now()}-${index}`) } as T;
}

export function createBackupPayload(data: Omit<BackupData, 'exportedAt' | 'version'>) {
  return {
    app: 'biz-bond-central',
    format: 'full-backup-v4',
    version: 4,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function parseBackupJson(json: string): BackupParseResult {
  const issues: BackupParseResult['issues'] = [];
  const notices: BackupParseResult['notices'] = [];
  let parsed: any;
  try { parsed = JSON.parse(json); }
  catch { return { ok: false, error: 'File is not valid JSON.', issues: [{ path: 'root', message: 'JSON file မဟုတ်ပါ' }], notices, meta: { format: 'unknown', bytes: json.length, imageCount: 0, embeddedImageCount: 0 } }; }

  const root = obj(parsed);
  if (!root) {
    return { ok: false, error: 'Backup root must be an object.', issues: [{ path: 'root', message: 'Backup data ပုံစံ မမှန်ပါ' }], notices, meta: { format: 'unknown', bytes: json.length, imageCount: 0, embeddedImageCount: 0 } };
  }

  const source = obj(root.data) || obj(root.payload) || obj(root.store) || root;
  const format = text(root.format || root.app || (root.data ? 'wrapped-backup' : 'legacy-json'), 'legacy-json');
  const images = countImages(source);
  const data: Partial<BackupData> = {};

  const products = arr(source.products);
  if (products) data.products = products.map((p, i) => normalizeProduct(p, i, notices)).filter(Boolean) as Product[];

  const customers = arr(source.customers);
  if (customers) data.customers = customers.map((c, i) => normalizeNamed<Customer>(c, i, 'customers', notices)).filter(Boolean) as Customer[];

  const vendors = arr(source.vendors);
  if (vendors) data.vendors = vendors.map((v, i) => normalizeNamed<Vendor>(v, i, 'vendors', notices)).filter(Boolean) as Vendor[];

  const purchases = arr(source.purchases);
  if (purchases) data.purchases = purchases.map((p, i) => normalizeWithId<PurchaseOrder>(p, i, 'purchases', notices)).filter(Boolean) as PurchaseOrder[];

  const ledger = arr(source.ledger);
  if (ledger) data.ledger = ledger.map((l, i) => normalizeWithId<LedgerEntry>(l, i, 'ledger', notices)).filter(Boolean) as LedgerEntry[];

  const invoices = arr(source.invoices);
  if (invoices) data.invoices = invoices.map((inv, i) => normalizeWithId<Invoice>(inv, i, 'invoices', notices)).filter(Boolean) as Invoice[];

  const settings = obj(source.settings);
  if (settings) data.settings = { ...settings, storeName: text(settings.storeName), storeNote: text(settings.storeNote), heroImageUrl: maybeText(settings.heroImageUrl), logoImageUrl: maybeText(settings.logoImageUrl) };

  const theme = obj(source.theme);
  if (theme) data.theme = { ...DEFAULT_THEME, ...theme, primaryHue: num(theme.primaryHue, DEFAULT_THEME.primaryHue), primarySat: num(theme.primarySat, DEFAULT_THEME.primarySat), primaryLight: num(theme.primaryLight, DEFAULT_THEME.primaryLight), radius: num(theme.radius, DEFAULT_THEME.radius) };

  const prefs = obj(source.prefs);
  if (prefs) data.prefs = { ...DEFAULT_PREFS, ...prefs, currency: text(prefs.currency, DEFAULT_PREFS.currency), currencyPosition: prefs.currencyPosition === 'before' ? 'before' : 'after', language: prefs.language === 'en' ? 'en' : 'my' };

  const categories = arr(source.categories);
  if (categories) data.categories = categories.map((c) => text(c)).filter(Boolean);

  if (!Object.keys(data).length) issues.push({ path: 'root', message: 'Import လုပ်နိုင်တဲ့ products/customers/vendors/purchases data မတွေ့ပါ' });

  return {
    ok: issues.length === 0,
    data,
    error: issues.length ? `${issues.length} issue(s) found.` : undefined,
    issues,
    notices,
    meta: { exportedAt: maybeText(root.exportedAt || source.exportedAt), version: maybeText(root.version || source.version), format, bytes: json.length, ...images },
  };
}