import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  Product, Customer, Vendor, PurchaseOrder, LedgerEntry,
  Invoice, CartItem, StoreSettings,
} from '@/types';
import { ThemeSettings, AppPreferences, DEFAULT_THEME, DEFAULT_PREFS, T } from './customization';
import { sha256, DEFAULT_ADMIN_PASSWORD_HASH } from '@/lib/crypto';
import { importSchema } from '@/lib/importSchema';

// Stored shape — password is ALWAYS a SHA-256 hex digest, never plaintext.
interface StoredAdminCreds { username: string; passwordHash: string; }

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
  // Default password is 'admin' — stored as its SHA-256 hash, never plaintext.
  adminCreds: { username: 'admin', passwordHash: DEFAULT_ADMIN_PASSWORD_HASH } as StoredAdminCreds,
};

const StoreContext = createContext<StoreState | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);

function migrateCreds(parsed: any): StoredAdminCreds {
  // Migrate legacy plaintext creds: { username, password } -> { username, passwordHash }
  const c = parsed?.adminCreds;
  if (c && typeof c.passwordHash === 'string') {
    return { username: String(c.username || 'admin'), passwordHash: c.passwordHash };
  }
  if (c && typeof c.password === 'string') {
    // Legacy users had plaintext stored — fall back to default hash and force change.
    return { username: String(c.username || 'admin'), passwordHash: DEFAULT_ADMIN_PASSWORD_HASH };
  }
  return defaultState.adminCreds;
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

  // Persist (note: only the password HASH is ever written, never plaintext)
  useEffect(() => {
    const data = { products, customers, vendors, purchases, ledger, invoices, cart, settings, theme, prefs, categories, adminCreds };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota or privacy mode */ }
  }, [products, customers, vendors, purchases, ledger, invoices, cart, settings, theme, prefs, categories, adminCreds]);

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
    isDefaultAdminPassword: adminCreds.passwordHash === DEFAULT_ADMIN_PASSWORD_HASH,
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
      const passwordHash = await sha256(c.password);
      setAdminCreds({ username: c.username, passwordHash });
    },
    loginAdmin: async (u, p) => {
      const hash = await sha256(p);
      if (u === adminCreds.username && hash === adminCreds.passwordHash) {
        setIsAdmin(true);
        return true;
      }
      return false;
    },
    logoutAdmin: () => setIsAdmin(false),

    exportData: () => {
      // Backup payload deliberately EXCLUDES adminCreds — credentials must never
      // travel in a JSON file that could be intercepted, shared, or reimported
      // to overwrite another device's login.
      const data = { products, customers, vendors, purchases, ledger, invoices, settings, theme, prefs, categories, exportedAt: new Date().toISOString(), version: 3 };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${settings.storeName.replace(/\s+/g, '-')}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    importData: (json) => {
      let parsed: unknown;
      try { parsed = JSON.parse(json); } catch { return { ok: false, error: 'File is not valid JSON.' }; }
      const result = importSchema.safeParse(parsed);
      if (!result.success) {
        return { ok: false, error: 'Backup file failed validation and was rejected.' };
      }
      const d = result.data;
      // adminCreds is never accepted from imports — schema strips it.
      if (d.products) setProducts(d.products as unknown as Product[]);
      if (d.customers) setCustomers(d.customers as unknown as Customer[]);
      if (d.vendors) setVendors(d.vendors as unknown as Vendor[]);
      if (d.purchases) setPurchases(d.purchases as unknown as PurchaseOrder[]);
      if (d.ledger) setLedger(d.ledger as unknown as LedgerEntry[]);
      if (d.invoices) setInvoices(d.invoices as unknown as Invoice[]);
      if (d.settings) setSettings((prev) => ({ ...prev, ...d.settings }));
      if (d.theme) setTheme((prev) => ({ ...prev, ...(d.theme as Partial<ThemeSettings>) }));
      if (d.prefs) setPrefs((prev) => ({ ...prev, ...(d.prefs as Partial<AppPreferences>) }));
      if (d.categories) setCategoriesState(d.categories);
      return { ok: true };
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
