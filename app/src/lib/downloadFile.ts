export function downloadTextFile(filename: string, content: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildInvoiceHtml(params: {
  invoiceNo: string;
  date: string;
  billedTo: string;
  billedToDetail: string;
  lineItems: { label: string; amount: number }[];
  total: number;
}): string {
  const rows = params.lineItems
    .map(
      (item) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;">${item.label}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">₹${item.amount.toLocaleString("en-IN")}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${params.invoiceNo}</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:40px auto;color:#1A1A2E;">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #FF6B00;padding-bottom:16px;margin-bottom:24px;">
    <div>
      <h1 style="margin:0;color:#FF6B00;">Ridepay</h1>
      <p style="margin:4px 0 0;color:#6B7280;font-size:12px;">Har Safar, Assaan Safar</p>
    </div>
    <div style="text-align:right;">
      <h2 style="margin:0;">INVOICE</h2>
      <p style="margin:4px 0 0;color:#6B7280;font-size:13px;">${params.invoiceNo}<br>${params.date}</p>
    </div>
  </div>
  <div style="margin-bottom:24px;">
    <p style="margin:0;color:#6B7280;font-size:12px;">BILLED TO</p>
    <p style="margin:4px 0 0;font-weight:bold;">${params.billedTo}</p>
    <p style="margin:2px 0 0;color:#6B7280;font-size:13px;">${params.billedToDetail}</p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead><tr><th style="text-align:left;border-bottom:2px solid #1A1A2E;padding-bottom:8px;">Description</th><th style="text-align:right;border-bottom:2px solid #1A1A2E;padding-bottom:8px;">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;">
    <table><tr><td style="padding:8px 24px;font-weight:bold;font-size:16px;">Total</td><td style="padding:8px 0;font-weight:bold;font-size:16px;text-align:right;">₹${params.total.toLocaleString("en-IN")}</td></tr></table>
  </div>
  <p style="margin-top:40px;color:#9CA3AF;font-size:11px;text-align:center;">This is a system-generated invoice from Ridepay.</p>
</body></html>`;
}
