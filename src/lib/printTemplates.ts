// Print HTML templates for invoices, purchases, items, ledger, P&L.

import { Invoice, PurchaseOrder, Product, LedgerEntry, StoreSettings } from '@/types';
import { escapeHtml } from './print';

const e = escapeHtml;

function header(settings: StoreSettings, subtitle: string): string {
  return `
    <div class="header">
      <div>
        <h1>${e(settings.storeName)}</h1>
        <p class="muted">${e(settings.storeNote || '')}</p>
      </div>
      <div class="right">
        <h2>${e(subtitle)}</h2>
        <p class="muted">${new Date().toLocaleString()}</p>
      </div>
    </div>
  `;
}

export function invoiceHtml(inv: Invoice, settings: StoreSettings, fmt: (n: number) => string): string {
  const rows = inv.lines.map((l) => `
    <tr>
      <td>${e(l.productName)}</td>
      <td class="right">${l.qty}</td>
      <td class="right">${fmt(l.price)}</td>
      <td class="right">${fmt(l.price * l.qty)}</td>
    </tr>
  `).join('');
  return `
    ${header(settings, `Invoice #${inv.id.slice(0, 6).toUpperCase()}`)}
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
      <div>
        <strong>Customer:</strong> ${e(inv.customerName)}<br/>
        ${inv.phoneNumber ? `<strong>Phone:</strong> ${e(inv.phoneNumber)}<br/>` : ''}
        <strong>Type:</strong> <span class="badge">${inv.saleType.toUpperCase()}</span>
      </div>
      <div class="right">
        <strong>Date:</strong> ${new Date(inv.date).toLocaleDateString()}<br/>
        <strong>Time:</strong> ${new Date(inv.date).toLocaleTimeString()}
      </div>
    </div>
    <table>
      <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div>Subtotal: ${fmt(inv.total)}</div>
      <div>Paid: ${fmt(inv.paidAmount)}</div>
      <div>Balance: ${fmt(inv.total - inv.paidAmount)}</div>
      <div class="grand">TOTAL: ${fmt(inv.total)}</div>
    </div>
    ${inv.note ? `<p class="muted" style="margin-top:12px;font-style:italic;">${e(inv.note)}</p>` : ''}
    <p class="muted" style="text-align:center;margin-top:24px;">Thank you for your business!</p>
  `;
}

export function invoiceReceiptHtml(inv: Invoice, settings: StoreSettings, fmt: (n: number) => string): string {
  const rows = inv.lines.map((l) => `
    <tr>
      <td colspan="2">${e(l.productName)}</td>
    </tr>
    <tr>
      <td>${l.qty} × ${fmt(l.price)}</td>
      <td class="right">${fmt(l.price * l.qty)}</td>
    </tr>
  `).join('');
  return `
    <h1>${e(settings.storeName)}</h1>
    <div class="center muted">${e(settings.storeNote || '')}</div>
    <div class="divider"></div>
    <div class="row"><span>Invoice:</span><span>#${inv.id.slice(0, 6).toUpperCase()}</span></div>
    <div class="row"><span>Date:</span><span>${new Date(inv.date).toLocaleString()}</span></div>
    <div class="row"><span>Customer:</span><span>${e(inv.customerName)}</span></div>
    ${inv.phoneNumber ? `<div class="row"><span>Phone:</span><span>${e(inv.phoneNumber)}</span></div>` : ''}
    <div class="row"><span>Type:</span><span>${inv.saleType.toUpperCase()}</span></div>
    <div class="divider"></div>
    <table>${rows}</table>
    <div class="divider"></div>
    <div class="row"><span>Subtotal:</span><span>${fmt(inv.total)}</span></div>
    <div class="row"><span>Paid:</span><span>${fmt(inv.paidAmount)}</span></div>
    <div class="row"><span>Balance:</span><span>${fmt(inv.total - inv.paidAmount)}</span></div>
    <div class="divider"></div>
    <div class="row grand"><span>TOTAL</span><span>${fmt(inv.total)}</span></div>
    <div class="divider"></div>
    ${inv.note ? `<div class="muted">${e(inv.note)}</div>` : ''}
    <div class="center muted" style="margin-top:8px;">Thank you!</div>
  `;
}

export function purchaseHtml(po: PurchaseOrder, settings: StoreSettings, fmt: (n: number) => string): string {
  const total = po.lines.reduce((s, l) => s + l.orderedQty * l.cost, 0);
  const rows = po.lines.map((l) => `
    <tr>
      <td>${e(l.itemName)}</td>
      <td class="right">${l.orderedQty}</td>
      <td class="right">${l.receivedQty}</td>
      <td class="right">${fmt(l.cost)}</td>
      <td class="right">${fmt(l.orderedQty * l.cost)}</td>
    </tr>
  `).join('');
  return `
    ${header(settings, `Purchase Order #${po.id.slice(0, 6).toUpperCase()}`)}
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
      <div>
        <strong>Vendor:</strong> ${e(po.vendorName)}<br/>
        <strong>Status:</strong> <span class="badge">${po.status.toUpperCase()}</span>
      </div>
      <div class="right">
        <strong>Order Date:</strong> ${e(po.orderDate)}<br/>
        ${po.expectedDate ? `<strong>Expected:</strong> ${e(po.expectedDate)}` : ''}
      </div>
    </div>
    <table>
      <thead><tr><th>Item</th><th class="right">Ordered</th><th class="right">Received</th><th class="right">Cost</th><th class="right">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals"><div class="grand">TOTAL: ${fmt(total)}</div></div>
    ${po.note ? `<p class="muted" style="margin-top:12px;font-style:italic;">${e(po.note)}</p>` : ''}
  `;
}

export function itemsHtml(products: Product[], settings: StoreSettings, fmt: (n: number) => string): string {
  const rows = products.map((p) => `
    <tr>
      <td>${e(p.name)}</td>
      <td>${e(p.category)}</td>
      <td class="right">${p.stock}</td>
      <td class="right">${fmt(p.cost)}</td>
      <td class="right">${fmt(p.price)}</td>
      <td>${e(p.location || '')}</td>
    </tr>
  `).join('');
  const totalValue = products.reduce((s, p) => s + p.stock * p.cost, 0);
  return `
    ${header(settings, `Items List (${products.length})`)}
    <table>
      <thead><tr><th>Name</th><th>Category</th><th class="right">Stock</th><th class="right">Cost</th><th class="right">Price</th><th>Location</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals"><div class="grand">Inventory Value: ${fmt(totalValue)}</div></div>
  `;
}

export function ledgerHtml(
  ledger: LedgerEntry[],
  type: 'receivable' | 'payable',
  settings: StoreSettings,
  fmt: (n: number) => string,
): string {
  const filtered = ledger.filter((l) => l.type === type);
  const rows = filtered.map((l) => `
    <tr>
      <td>${e(l.name)}</td>
      <td class="right">${fmt(l.amount)}</td>
      <td>${e(l.dueDate || '')}</td>
      <td>${e(l.note || '')}</td>
    </tr>
  `).join('');
  const total = filtered.reduce((s, l) => s + l.amount, 0);
  const label = type === 'receivable' ? 'Accounts Receivable (ရရန်)' : 'Accounts Payable (ပေးရန်)';
  return `
    ${header(settings, label)}
    <table>
      <thead><tr><th>Name</th><th class="right">Amount</th><th>Due Date</th><th>Note</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals"><div class="grand">TOTAL: ${fmt(total)}</div></div>
  `;
}

export function pnlHtml(
  data: {
    from: string; to: string;
    totalSales: number; totalCOGS: number; grossProfit: number; margin: number;
    totalPurchases: number; invoiceCount: number;
    totalReceivable: number; totalPayable: number;
    monthlyArr: [string, { sales: number; cost: number }][];
    topItems: { name: string; qty: number; sales: number; cost: number; profit: number }[];
  },
  settings: StoreSettings,
  fmt: (n: number) => string,
): string {
  const monthRows = data.monthlyArr.map(([m, v]) => `
    <tr><td>${e(m)}</td><td class="right">${fmt(v.sales)}</td><td class="right">${fmt(v.cost)}</td><td class="right">${fmt(v.sales - v.cost)}</td></tr>
  `).join('');
  const itemRows = data.topItems.map((it) => `
    <tr><td>${e(it.name)}</td><td class="right">${it.qty}</td><td class="right">${fmt(it.sales)}</td><td class="right">${fmt(it.cost)}</td><td class="right">${fmt(it.profit)}</td></tr>
  `).join('');
  return `
    ${header(settings, 'Profit & Loss Report')}
    <p class="muted">Period: ${e(data.from)} → ${e(data.to)}</p>
    <table>
      <tbody>
        <tr><td><strong>Total Sales</strong></td><td class="right">${fmt(data.totalSales)}</td></tr>
        <tr><td>COGS</td><td class="right">${fmt(data.totalCOGS)}</td></tr>
        <tr><td><strong>Gross Profit</strong></td><td class="right"><strong>${fmt(data.grossProfit)}</strong></td></tr>
        <tr><td>Margin</td><td class="right">${data.margin.toFixed(1)}%</td></tr>
        <tr><td>Invoices</td><td class="right">${data.invoiceCount}</td></tr>
        <tr><td>Total Purchases</td><td class="right">${fmt(data.totalPurchases)}</td></tr>
        <tr><td>Receivable</td><td class="right">${fmt(data.totalReceivable)}</td></tr>
        <tr><td>Payable</td><td class="right">${fmt(data.totalPayable)}</td></tr>
        <tr><td><strong>Net</strong></td><td class="right"><strong>${fmt(data.totalReceivable - data.totalPayable)}</strong></td></tr>
      </tbody>
    </table>
    <h2 style="margin-top:20px;">Monthly Breakdown</h2>
    <table>
      <thead><tr><th>Month</th><th class="right">Sales</th><th class="right">Cost</th><th class="right">Profit</th></tr></thead>
      <tbody>${monthRows || '<tr><td colspan="4" class="muted">No data</td></tr>'}</tbody>
    </table>
    <h2 style="margin-top:20px;">Top Items by Profit</h2>
    <table>
      <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Sales</th><th class="right">Cost</th><th class="right">Profit</th></tr></thead>
      <tbody>${itemRows || '<tr><td colspan="5" class="muted">No data</td></tr>'}</tbody>
    </table>
  `;
}
