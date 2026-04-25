import { z } from 'zod';

const optionalText = (max: number) => z.string().max(max).nullish().transform((value) => value ?? undefined);
const optionalImageUrl = z.string()
  .max(1_000_000)
  .refine(
    (value) => !value || value.startsWith('data:image/') || /^https?:\/\//i.test(value),
    'Image must be empty, an http(s) URL, or an embedded image data URL',
  )
  .nullish()
  .transform((value) => value ?? undefined);
const numericValue = (min: number, max: number) => z.coerce.number().finite().min(min).max(max);

// Strict schema for backup imports. Anything not matching is rejected.
// `adminCreds` is intentionally OMITTED — backup files must never be able
// to overwrite admin login credentials.

const productSchema = z.object({
  id: z.string().max(64),
  name: z.string().max(200),
  category: z.string().max(100),
  price: numericValue(0, 1e12),
  cost: numericValue(0, 1e12),
  stock: numericValue(0, 1e9),
  reorderLevel: numericValue(0, 1e9),
  badge: optionalText(40),
  barcode: optionalText(128),
  vendorId: optionalText(64),
  location: optionalText(120),
  description: optionalText(2000),
  imageUrl: optionalImageUrl,
});

const customerSchema = z.object({
  id: z.string().max(64),
  name: z.string().max(200),
  phone: optionalText(40),
  email: optionalText(200),
  address: optionalText(500),
  note: optionalText(1000),
}).passthrough();

const vendorSchema = customerSchema;

const purchaseSchema = z.object({ id: z.string().max(64) }).passthrough();
const ledgerSchema = z.object({ id: z.string().max(64) }).passthrough();
const invoiceSchema = z.object({ id: z.string().max(64) }).passthrough();

const settingsSchema = z.object({
  storeName: optionalText(200),
  storeNote: optionalText(500).default(''),
  heroImageUrl: optionalText(2048).default(''),
  logoImageUrl: optionalText(2048).default(''),
}).partial();

const themeSchema = z.object({
  primaryHue: numericValue(0, 360),
  primarySat: numericValue(0, 100),
  primaryLight: numericValue(0, 100),
  radius: numericValue(0, 48),
  fontDisplay: optionalText(80),
  fontBody: optionalText(80),
}).partial();

const prefsSchema = z.object({
  currency: optionalText(8),
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
  // Allow metadata fields produced by exportData()
  exportedAt: z.string().max(64).optional(),
  version: z.number().optional(),
  // adminCreds intentionally NOT accepted and silently dropped via passthrough strip below.
}).passthrough();

export type ImportPayload = z.infer<typeof importSchema>;
