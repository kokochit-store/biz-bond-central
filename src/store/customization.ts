// Customization types extending StoreSettings
export interface ThemeSettings {
  primaryHue: number;        // 0-360
  primarySat: number;        // 0-100
  primaryLight: number;      // 0-100
  fontDisplay: 'Playfair Display' | 'DM Sans' | 'Inter' | 'Noto Sans Myanmar';
  fontBody: 'DM Sans' | 'Inter' | 'Noto Sans Myanmar';
  radius: number;            // px
}

export interface AppPreferences {
  currency: string;          // e.g. 'Ks', 'USD', 'THB'
  currencyPosition: 'after' | 'before';
  language: 'my' | 'en';
}

export const DEFAULT_THEME: ThemeSettings = {
  primaryHue: 24,
  primarySat: 80,
  primaryLight: 50,
  fontDisplay: 'Playfair Display',
  fontBody: 'DM Sans',
  radius: 12,
};

export const DEFAULT_PREFS: AppPreferences = {
  currency: 'Ks',
  currencyPosition: 'after',
  language: 'my',
};

export const T = {
  my: {
    overview: 'ပင်မ',
    shop: 'စျေးဆိုင်',
    invoices: 'ရောင်းအား',
    admin: 'အက်ဒမင်',
    cart: 'စျေးခြင်း',
    items: 'ပစ္စည်းများ',
    customers: 'ဖောက်သည်များ',
    vendors: 'ပို့ဆောင်သူများ',
    purchases: 'ဝယ်ယူမှု',
    ledger: 'ရရန်/ပေးရန်',
    pl: 'အမြတ်/အရှုံး',
    customize: 'စိတ်တိုင်းကျ',
    settings: 'ဆက်တင်',
    save: 'သိမ်းရန်',
    delete: 'ဖျက်ရန်',
    edit: 'ပြင်ရန်',
    addNew: 'အသစ်ထည့်ရန်',
    search: 'ရှာရန်',
    total: 'စုစုပေါင်း',
    stock: 'လက်ကျန်',
    addToCart: 'ထည့်ရန်',
    saveInvoice: 'ဘောင်ချာသိမ်းရန်',
  },
  en: {
    overview: 'Overview',
    shop: 'Shop',
    invoices: 'Invoices',
    admin: 'Admin',
    cart: 'Cart',
    items: 'Items',
    customers: 'Customers',
    vendors: 'Vendors',
    purchases: 'Purchases',
    ledger: 'Receivable/Payable',
    pl: 'Profit & Loss',
    customize: 'Customize',
    settings: 'Settings',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    addNew: 'Add New',
    search: 'Search',
    total: 'Total',
    stock: 'Stock',
    addToCart: 'Add to Cart',
    saveInvoice: 'Save Invoice',
  },
};
