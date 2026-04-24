// Print utility — opens a styled new window with print-friendly content.
// Works on Android, iOS, macOS, Windows browsers (uses native print dialog).
// User can pick "Save as PDF" or any connected printer (thermal or A4).

interface PrintOptions {
  title: string;
  bodyHtml: string;
  /** Set to true for thermal/receipt printers (80mm width). */
  receipt?: boolean;
}

const baseCss = `
  * { box-sizing: border-box; }
  body { font-family: 'DM Sans', 'Noto Sans Myanmar', system-ui, sans-serif; color: #111; margin: 0; padding: 24px; }
  h1, h2, h3 { margin: 0 0 8px; font-family: 'Playfair Display', 'Noto Sans Myanmar', serif; }
  h1 { font-size: 22px; }
  h2 { font-size: 16px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #ddd; }
  th { background: #f4f1eb; font-weight: 600; }
  .right { text-align: right; }
  .muted { color: #666; font-size: 11px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #111; }
  .totals { margin-top: 12px; text-align: right; font-size: 13px; }
  .totals .grand { font-size: 18px; font-weight: 700; margin-top: 4px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #f0f0f0; font-size: 11px; }
  @media print {
    body { padding: 12mm; }
    .no-print { display: none !important; }
    button { display: none !important; }
  }
`;

const receiptCss = `
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', 'Noto Sans Myanmar', monospace; color: #000; margin: 0; padding: 6mm; width: 80mm; font-size: 11px; line-height: 1.4; }
  h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
  .center { text-align: center; }
  .right { text-align: right; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  .grand { font-size: 13px; font-weight: 700; }
  @media print {
    @page { size: 80mm auto; margin: 0; }
    body { padding: 4mm; }
    button { display: none !important; }
  }
`;

export function printHtml({ title, bodyHtml, receipt = false }: PrintOptions): void {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('Please allow popups to print.');
    return;
  }
  const css = receipt ? receiptCss : baseCss;
  w.document.open();
  w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&family=Noto+Sans+Myanmar:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${css}</style>
</head>
<body>
  ${bodyHtml}
  <div class="no-print" style="position:fixed;top:8px;right:8px;display:flex;gap:8px;">
    <button onclick="window.print()" style="padding:8px 14px;background:#dc7a1f;color:#fff;border:0;border-radius:6px;cursor:pointer;font-weight:600;">🖨 Print</button>
    <button onclick="window.close()" style="padding:8px 14px;background:#eee;border:0;border-radius:6px;cursor:pointer;">Close</button>
  </div>
</body>
</html>`);
  w.document.close();
  // Wait for fonts/layout, then trigger print.
  w.onload = () => {
    setTimeout(() => {
      try { w.focus(); w.print(); } catch { /* user can press button */ }
    }, 300);
  };
}

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
