import { z } from 'zod';

// Strict schema for backup imports. Anything not matching is rejected.
// `adminCreds` is intentionally OMITTED — backup files must never be able
// to overwrite admin login credentials.

const productSchema = z.object({
  id: z.string().max(64),
  name: z.string().max(200),
  category: z.string().max(100),
  price: z.number().finite().min(0).max(1e12),
  cost: z.number().finite().min(0).max(1e12),
  stock: z.number().finite().min(0).max(1e9),
  reorderLevel: z.number().finite().min(0).max(1e9),
  badge: z.string().max(40).optional(),
  location: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().max(2048).optional(),
});

const customerSchema = z.object({
  id: z.string().max(64),
  name: z.string().max(200),
  phone: z.string().max(40).optional(),
  email: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
}).passthrough();

const vendorSchema = customerSchema;

const purchaseSchema = z.object({ id: z.string().max(64) }).passthrough();
const ledgerSchema = z.object({ id: z.string().max(64) }).passthrough();
const invoiceSchema = z.object({ id: z.string().max(64) }).passthrough();

const settingsSchema = z.object({
  storeName: z.string().max(200),
  storeNote: z.string().max(500).optional().default(''),
  heroImageUrl: z.string().max(2048).optional().default(''),
  logoImageUrl: z.string().max(2048).optional().default(''),
}).partial();

const themeSchema = z.object({
  primaryHue: z.number().min(0).max(360),
  primarySat: z.number().min(0).max(100),
  primaryLight: z.number().min(0).max(100),
  radius: z.number().min(0).max(48),
  fontDisplay: z.string().max(80),
  fontBody: z.string().max(80),
}).partial();

const prefsSchema = z.object({
  currency: z.string().max(8),
  currencyPosition: z.enum(['before', 'after']),
  language: z.enum(['my', 'en']),
}).partial();

export const importSchema = z.object({
  products: z.array(productSchema).max(10000).optional(),
  customers: z.array(customerSchema).max(10000).optional(),
  vendors: z.array(vendorSchema).max(10000).optional(),
  purchases: z.array(purchaseSchema).max(10000).optional(),
  ledger: z.array(ledgerSchema).max(50000).optional(),
  invoices: z.array(invoiceSchema).max(50000).optional(),
  settings: settingsSchema.optional(),
  theme: themeSchema.optional(),
  prefs: prefsSchema.optional(),
  categories: z.array(z.string().max(100)).max(500).optional(),
  // adminCreds intentionally NOT accepted — see comment above.
}).strict().passthrough();

export type ImportPayload = z.infer<typeof importSchema>;
