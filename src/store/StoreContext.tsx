import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  Product, Customer, Vendor, PurchaseOrder, LedgerEntry,
  Invoice, CartItem, StoreSettings,
} from '@/types';
import { ThemeSettings, AppPreferences, DEFAULT_THEME, DEFAULT_PREFS, T } from './customization';
import {
  hashPassword, verifyPassword, isDefaultPasswordHash,
  DEFAULT_PASSWORD_SENTINEL, DEFAULT_PASSWORD_PLAINTEXT,
  type PasswordHash,
} from '@/lib/crypto';
import { createBackupPayload, parseBackupJson } from '@/lib/backup';

// Stored shape — password is ALWAYS a salted PBKDF2 hash, never plaintext.
interface StoredAdminCreds { username: string; passwordHash: PasswordHash; }

interface StoreState {
  products: Product[];
  customers: Customer[];
  vendors: Vendor[];
  purchases: PurchaseOrder[];
  ledger: LedgerEntry[];
  invoices: Invoice[];
  cart: CartItem[];
  settings: StoreSettings;
  theme: ThemeSettings;
  prefs: AppPreferences;
  categories: string[];
  // Only the username and a "is default password" flag are exposed.
  // The password hash is intentionally NOT part of the context surface.
  adminUsername: string;
  isDefaultAdminPassword: boolean;
  isAdmin: boolean;
  t: (typeof T)['my'];

  setProducts: (p: Product[]) => void;
  upsertProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;

  upsertCustomer: (c: Customer) => void;
  deleteCustomer: (id: string) => void;
  reorderCustomers: (next: Customer[]) => void;

  upsertVendor: (v: Vendor) => void;
  deleteVendor: (id: string) => void;
  reorderVendors: (next: Vendor[]) => void;

  upsertPurchase: (p: PurchaseOrder) => void;
  deletePurchase: (id: string) => void;
  reorderPurchases: (next: PurchaseOrder[]) => void;

  upsertLedger: (l: LedgerEntry) => void;
  deleteLedger: (id: string) => void;
  reorderLedger: (next: LedgerEntry[]) => void;

  reorderInvoices: (next: Invoice[]) => void;

  addToCart: (p: Product, qty?: number) => void;
  updateCartQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;

  saveInvoice: (i: Omit<Invoice, 'id' | 'date'>) => Invoice;
  deleteInvoice: (id: string) => void;
  clearInvoices: () => void;

  updateSettings: (s: Partial<StoreSettings>) => void;
  updateTheme: (t: Partial<ThemeSettings>) => void;
  updatePrefs: (p: Partial<AppPreferences>) => void;
  setCategories: (c: string[]) => void;
  updateAdminCreds: (c: { username: string; password: string }) => Promise<void>;
  loginAdmin: (u: string, p: string) => Promise<boolean>;
  logoutAdmin: () => void;

  exportData: () => void;
  importData: (json: string) => { ok: boolean; error?: string };
  testImport: (json: string) => {
    ok: boolean;
    error?: string;
    issues: { path: string; message: string }[];
    notices: { path: string; message: string }[];
    summary: { key: string; current: number | string; incoming: number | string; delta?: string }[];
  };
  resetAll: () => void;

  formatPrice: (n: number) => string;
}

const STORAGE_KEY = 'pt-store-v2';

const seedProducts: Product[] = [
  { id: 'p1', name: 'Cordless Drill 18V', category: 'Power Tools', price: 185000, cost: 140000, stock: 8, reorderLevel: 3, badge: 'NEW', location: 'Shelf A-1', description: 'Heavy duty cordless drill with 2 batteries.' },
  { id: 'p2', name: 'Hammer 16oz', category: 'Hand Tools', price: 12000, cost: 7500, stock: 24, reorderLevel: 5, location: 'Shelf B-2', description: 'Steel claw hammer with rubber grip.' },
  { id: 'p3', name: 'PVC Pipe 1/2"', category: 'Plumbing', price: 4500, cost: 2800, stock: 60, reorderLevel: 20, location: 'Store Room', description: 'Standard PVC water pipe (per meter).' },
  { id: 'p4', name: 'LED Bulb 12W', category: 'Electrical', price: 3500, cost: 2000, stock: 120, reorderLevel: 30, location: 'Shelf C-3', description: 'Energy saving LED bulb, warm white.' },
  { id: 'p5', name: 'Paint Brush 3"', category: 'Paint', price: 2500, cost: 1300, stock: 4, reorderLevel: 10, badge: 'LOW', location: 'Shelf D-1', description: 'Soft bristle paint brush.' },
  { id: 'p6', name: 'Steel Nails 3"', category: 'Hardware', price: 800, cost: 500, stock: 200, reorderLevel: 50, location: 'Drawer 4', description: 'Per kg, galvanized.' },
];

const DEFAULT_CATEGORIES = ['Power Tools', 'Hand Tools', 'Plumbing', 'Electrical', 'Paint', 'Hardware', 'Accessories'];

const defaultState = {
  products: seedProducts,
  customers: [] as Customer[],
  vendors: [{ id: 'v1', name: 'Mandalay Tool Supply', phone: '09111222333', note: 'Power tools wholesaler' }] as Vendor[],
  purchases: [] as PurchaseOrder[],
  ledger: [] as LedgerEntry[],
  invoices: [] as Invoice[],
  cart: [] as CartItem[],
  settings: {
    storeName: 'ဖိုးတရုတ် Hardware',
    storeNote: 'Hand tools, power tools နှင့် accessories',
    heroImageUrl: '',
    logoImageUrl: '',
  } as StoreSettings,
  theme: DEFAULT_THEME,
  prefs: DEFAULT_PREFS,
  categories: DEFAULT_CATEGORIES,
  // Default password is 'admin' — represented by a sentinel marker so no real
  // hash for the default password is ever stored. The user is forced to set a
  // proper PBKDF2 hash on first password change.
  adminCreds: { username: 'admin', passwordHash: DEFAULT_PASSWORD_SENTINEL } as StoredAdminCreds,
};

const StoreContext = createContext<StoreState | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);

const MAX_STORED_IMAGE_URL_LENGTH = 250_000;
const NON_NEGATIVE_IMPORT_PRODUCT_FIELDS = ['stock', 'reorderLevel'] as const;

function normalizeImportPayload<T extends { products?: unknown[] }>(data: T): T {
  if (!data || typeof data !== 'object' || !Array.isArray(data.products)) return data;
  return {
    ...data,
    products: data.products.map((product: any) => {
      if (!product || typeof product !== 'object') return product;
      let next = product;

      for (const field of NON_NEGATIVE_IMPORT_PRODUCT_FIELDS) {
        const value = typeof next[field] === 'string' ? Number(next[field]) : next[field];
        if (typeof value === 'number' && Number.isFinite(value) && value < 0) {
          next = next === product ? { ...product } : next;
          next[field] = 0;
        }
      }

      if (typeof next.imageUrl === 'string' && next.imageUrl.length > MAX_STORED_IMAGE_URL_LENGTH) {
        next = next === product ? { ...product } : next;
        next.imageUrl = '';
      }

      return next;
    }),
  };
}

function migrateCreds(parsed: any): StoredAdminCreds {
  const c = parsed?.adminCreds;
  if (c && c.passwordHash && typeof c.passwordHash === 'object' && c.passwordHash.algo === 'pbkdf2-sha256') {
    return { username: String(c.username || 'admin'), passwordHash: c.passwordHash as PasswordHash };
  }
  // Legacy plaintext or legacy SHA-256 string hash — fall back to default
  // sentinel and force the user to set a new password.
  return { username: String(c?.username || 'admin'), passwordHash: DEFAULT_PASSWORD_SENTINEL };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      adminCreds: migrateCreds(parsed),
      theme: { ...DEFAULT_THEME, ...(parsed.theme || {}) },
      prefs: { ...DEFAULT_PREFS, ...(parsed.prefs || {}) },
    };
  } catch { return defaultState; }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = loadState();
  const [products, setProducts] = useState<Product[]>(initial.products);
  const [customers, setCustomers] = useState<Customer[]>(initial.customers);
  const [vendors, setVendors] = useState<Vendor[]>(initial.vendors);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>(initial.purchases);
  const [ledger, setLedger] = useState<LedgerEntry[]>(initial.ledger);
  const [invoices, setInvoices] = useState<Invoice[]>(initial.invoices);
  const [cart, setCart] = useState<CartItem[]>(initial.cart);
  const [settings, setSettings] = useState<StoreSettings>(initial.settings);
  const [theme, setTheme] = useState<ThemeSettings>(initial.theme);
  const [prefs, setPrefs] = useState<AppPreferences>(initial.prefs);
  const [categories, setCategoriesState] = useState<string[]>(initial.categories);
  const [adminCreds, setAdminCreds] = useState<StoredAdminCreds>(initial.adminCreds);
  const [isAdmin, setIsAdmin] = useState(false);

  // Persist (note: only the salted PBKDF2 password HASH is ever written, never plaintext)
  useEffect(() => {
    const data = { products, customers, vendors, purchases, ledger, invoices, cart, settings, theme, prefs, categories, adminCreds };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota or privacy mode */ }
  }, [products, customers, vendors, purchases, ledger, invoices, cart, settings, theme, prefs, categories, adminCreds]);

  // Idle session timeout — auto-logout admin after 15 minutes of no activity.
  // Also clear the sessionStorage gate on tab close so admin state never
  // silently persists across sessions.
  useEffect(() => {
    if (!isAdmin) return;
    sessionStorage.setItem('pt-admin-session', '1');
    const TIMEOUT_MS = 15 * 60 * 1000;
    let timer: number;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIsAdmin(false), TIMEOUT_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
      sessionStorage.removeItem('pt-admin-session');
    };
  }, [isAdmin]);

  // Apply theme to CSS variables
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--primary', `${theme.primaryHue} ${theme.primarySat}% ${theme.primaryLight}%`);
    r.style.setProperty('--ring', `${theme.primaryHue} ${theme.primarySat}% ${theme.primaryLight}%`);
    r.style.setProperty('--accent', `${theme.primaryHue} 60% 92%`);
    r.style.setProperty('--accent-foreground', `${theme.primaryHue} ${theme.primarySat}% 30%`);
    r.style.setProperty('--sidebar-active', `${theme.primaryHue} ${theme.primarySat}% ${theme.primaryLight}%`);
    r.style.setProperty('--radius', `${theme.radius / 16}rem`);
    r.style.setProperty('--font-display', `'${theme.fontDisplay}', 'Noto Sans Myanmar', serif`);
    r.style.setProperty('--font-body', `'${theme.fontBody}', 'Noto Sans Myanmar', sans-serif`);
  }, [theme]);

  const upsert = <T extends { id: string }>(setter: (fn: (prev: T[]) => T[]) => void) => (item: T) => {
    setter((prev) => {
      const idx = prev.findIndex((x) => x.id === item.id);
      if (idx === -1) return [...prev, item];
      const copy = [...prev]; copy[idx] = item; return copy;
    });
  };
  const remove = <T extends { id: string }>(setter: (fn: (prev: T[]) => T[]) => void) => (id: string) =>
    setter((prev) => prev.filter((x) => x.id !== id));

  const t = T[prefs.language];

  const formatPrice = (n: number) => {
    const num = (n || 0).toLocaleString();
    return prefs.currencyPosition === 'before' ? `${prefs.currency} ${num}` : `${num} ${prefs.currency}`;
  };

  const value: StoreState = {
    products, customers, vendors, purchases, ledger, invoices, cart, settings,
    theme, prefs, categories,
    adminUsername: adminCreds.username,
    isDefaultAdminPassword: isDefaultPasswordHash(adminCreds.passwordHash),
    isAdmin, t,
    setProducts,
    upsertProduct: upsert(setProducts),
    deleteProduct: remove(setProducts),
    upsertCustomer: upsert(setCustomers),
    deleteCustomer: remove(setCustomers),
    reorderCustomers: setCustomers,
    upsertVendor: upsert(setVendors),
    deleteVendor: remove(setVendors),
    reorderVendors: setVendors,
    upsertPurchase: upsert(setPurchases),
    deletePurchase: remove(setPurchases),
    reorderPurchases: setPurchases,
    upsertLedger: upsert(setLedger),
    deleteLedger: remove(setLedger),
    reorderLedger: setLedger,
    reorderInvoices: setInvoices,

    addToCart: (p, qty = 1) => setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === p.id);
      if (idx === -1) return [...prev, { product: p, qty }];
      const copy = [...prev]; copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty }; return copy;
    }),
    updateCartQty: (id, qty) =>
      setCart((prev) => prev.map((c) => (c.product.id === id ? { ...c, qty } : c)).filter((c) => c.qty > 0)),
    removeFromCart: (id) => setCart((prev) => prev.filter((c) => c.product.id !== id)),
    clearCart: () => setCart([]),

    saveInvoice: (data) => {
      const inv: Invoice = { ...data, id: uid(), date: new Date().toISOString() };
      setInvoices((prev) => [inv, ...prev]);
      setProducts((prev) => prev.map((p) => {
        const line = inv.lines.find((l) => l.productId === p.id);
        return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
      }));
      return inv;
    },
    deleteInvoice: (id) => setInvoices((prev) => prev.filter((i) => i.id !== id)),
    clearInvoices: () => setInvoices([]),

    updateSettings: (s) => setSettings((prev) => ({ ...prev, ...s })),
    updateTheme: (s) => setTheme((prev) => ({ ...prev, ...s })),
    updatePrefs: (s) => setPrefs((prev) => ({ ...prev, ...s })),
    setCategories: (c) => setCategoriesState(c),
    updateAdminCreds: async (c) => {
      const passwordHash = await hashPassword(c.password);
      setAdminCreds({ username: c.username, passwordHash });
    },
    loginAdmin: async (u, p) => {
      if (u !== adminCreds.username) return false;
      // First-run: default sentinel — accept the literal default password once.
      if (isDefaultPasswordHash(adminCreds.passwordHash)) {
        if (p === DEFAULT_PASSWORD_PLAINTEXT) { setIsAdmin(true); return true; }
        return false;
      }
      const ok = await verifyPassword(p, adminCreds.passwordHash);
      if (ok) setIsAdmin(true);
      return ok;
    },
    logoutAdmin: () => setIsAdmin(false),

    exportData: () => {
      // Backup payload deliberately EXCLUDES adminCreds — credentials must never
      // travel in a JSON file that could be intercepted, shared, or reimported
      // to overwrite another device's login.
      const data = createBackupPayload({ products, customers, vendors, purchases, ledger, invoices, settings, theme, prefs, categories });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${settings.storeName.replace(/\s+/g, '-')}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    importData: (json) => {
      const result = parseBackupJson(json);
      if (!result.ok || !result.data) {
        const first = result.issues[0];
        return { ok: false, error: first ? `${first.path}: ${first.message}` : (result.error || 'Invalid backup file') };
      }
      const d = result.data;
      // adminCreds is never accepted from imports — schema strips it.
      if (d.products) setProducts(d.products);
      if (d.customers) setCustomers(d.customers);
      if (d.vendors) setVendors(d.vendors);
      if (d.purchases) setPurchases(d.purchases);
      if (d.ledger) setLedger(d.ledger);
      if (d.invoices) setInvoices(d.invoices);
      if (d.settings) setSettings((prev) => ({ ...prev, ...d.settings }));
      if (d.theme) setTheme((prev) => ({ ...prev, ...(d.theme as Partial<ThemeSettings>) }));
      if (d.prefs) setPrefs((prev) => ({ ...prev, ...(d.prefs as Partial<AppPreferences>) }));
      if (d.categories) setCategoriesState(d.categories);
      return { ok: true };
    },
    testImport: (json) => {
      const issues: { path: string; message: string }[] = [];
      let parsed: any;
      try { parsed = JSON.parse(json); }
      catch (e: any) { return { ok: false, error: 'File is not valid JSON.', issues, summary: [] }; }
      const normalized = normalizeImportPayload(parsed);
      const result = importSchema.safeParse(normalized);
      if (!result.success) {
        for (const i of result.error.issues) {
          issues.push({ path: i.path.join('.') || 'root', message: i.message });
        }
        return { ok: false, error: `${issues.length} validation issue(s) found.`, issues, summary: [] };
      }
      const d = result.data;
      const len = (a: unknown) => Array.isArray(a) ? a.length : 0;
      const mk = (key: string, cur: number, inc: number | undefined) => ({
        key,
        current: cur,
        incoming: inc ?? '—',
        delta: inc === undefined ? 'no change' : `${inc - cur >= 0 ? '+' : ''}${inc - cur}`,
      });
      const summary = [
        mk('Products', products.length, d.products ? len(d.products) : undefined),
        mk('Customers', customers.length, d.customers ? len(d.customers) : undefined),
        mk('Vendors', vendors.length, d.vendors ? len(d.vendors) : undefined),
        mk('Purchases', purchases.length, d.purchases ? len(d.purchases) : undefined),
        mk('Ledger entries', ledger.length, d.ledger ? len(d.ledger) : undefined),
        mk('Invoices', invoices.length, d.invoices ? len(d.invoices) : undefined),
        mk('Categories', categories.length, d.categories ? len(d.categories) : undefined),
        { key: 'Settings', current: settings.storeName || '—', incoming: d.settings?.storeName || (d.settings ? '(partial)' : '—') },
        { key: 'Theme', current: 'current', incoming: d.theme ? 'will update' : 'no change' },
        { key: 'Preferences', current: prefs.language, incoming: d.prefs?.language || (d.prefs ? '(partial)' : 'no change') },
        { key: 'Exported at', current: '—', incoming: (parsed?.exportedAt as string) || '—' },
        { key: 'Version', current: '—', incoming: (parsed?.version as number)?.toString() || '—' },
      ];
      return { ok: true, issues, summary };
    },
    resetAll: () => {
      if (confirm('Reset ALL data? This cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      }
    },
    formatPrice,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export { uid };
