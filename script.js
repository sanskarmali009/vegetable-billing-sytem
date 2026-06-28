/* ============================================================
   VEGETABLE BILLING SYSTEM — script.js
   Clean, modular, well-commented JavaScript
   ============================================================ */

/* ---- Farm Configuration ---- */
const FARM = {
  name:    "MALI VEGETABLES",
  tagline: "Fresh Vegetables Direct from Farm",
  address: "Kaledhon",
  phone:   "9763017405",
};

/* ---- LocalStorage key ---- */
const STORAGE_KEY = "veg_bills_v1";

/* ---- State ---- */
let currentBillData = null;   // bill currently previewed
let modalBillId     = null;   // bill open in modal

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initForm();
  setInvoiceDefaults();
  renderDashboard();
  renderHistory();
  initMobileSidebar();
});


/* ============================================================
   NAVIGATION
   ============================================================ */
function initNav() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", e => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
      // close sidebar on mobile
      document.getElementById("sidebar").classList.remove("open");
      document.querySelector(".sidebar-overlay")?.classList.remove("show");
    });
  });
}

function navigateTo(pageId) {
  // Update nav active state
  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.page === pageId);
  });
  // Show correct page
  document.querySelectorAll(".page").forEach(p => {
    p.classList.toggle("active", p.id === "page-" + pageId);
  });
  // Refresh data when navigating to these pages
  if (pageId === "dashboard") renderDashboard();
  if (pageId === "bill-history") renderHistory();
  if (pageId === "create-bill") {
    setInvoiceDefaults();
    // hide preview when opening a fresh create-bill page
    document.getElementById("invoicePreviewCard").style.display = "none";
  }
}

/* ============================================================
   MOBILE SIDEBAR
   ============================================================ */
function initMobileSidebar() {
  // Create overlay element
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  document.body.appendChild(overlay);

  document.getElementById("menuBtn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
    overlay.classList.toggle("show");
  });
  overlay.addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("open");
    overlay.classList.remove("show");
  });
}


/* ============================================================
   LOCAL STORAGE HELPERS
   ============================================================ */
function getBills() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

function saveBills(bills) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
}

function addBill(bill) {
  const bills = getBills();
  bills.unshift(bill); // newest first
  saveBills(bills);
}

function deleteBillById(id) {
  const bills = getBills().filter(b => b.id !== id);
  saveBills(bills);
}

function getBillById(id) {
  return getBills().find(b => b.id === id) || null;
}

/* ============================================================
   INVOICE NUMBER & DATE GENERATION
   ============================================================ */
function generateInvoiceNumber() {
  const bills = getBills();
  const next  = bills.length + 1;
  return "INV-" + String(next).padStart(4, "0");
}

function formatDateDisplay(dateStr) {
  // dateStr: YYYY-MM-DD → DD-MM-YYYY
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}-${m}-${y}`;
}

function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function setInvoiceDefaults() {
  document.getElementById("invoiceNo").value = generateInvoiceNumber();
  const today = getTodayISO();
  document.getElementById("billDate").value  = formatDateDisplay(today);
  document.getElementById("billDate").dataset.iso = today;
}


/* ============================================================
   BILL FORM — Init, Multi-row Veg Table, Validation
   ============================================================ */

/* ---- Row counter for unique IDs ---- */
let vegRowCounter = 0;

function initForm() {
  // Seed the first vegetable row
  addVegRow();

  // Form submit
  document.getElementById("billForm").addEventListener("submit", e => {
    e.preventDefault();
    handleGenerateBill();
  });
}

/* ---- Add a new vegetable row ---- */
function addVegRow() {
  vegRowCounter++;
  const id   = vegRowCounter;
  const tbody = document.getElementById("vegRowsBody");

  const tr = document.createElement("tr");
  tr.dataset.rowId = id;
  tr.innerHTML = `
    <td class="veg-row-num">${tbody.children.length + 1}</td>
    <td><input type="text"   class="veg-name"  placeholder="e.g. टोमॅटो / Tomato" /></td>
    <td><input type="number" class="veg-qty"   placeholder="0" min="0.01" step="0.01" /></td>
    <td><input type="number" class="veg-rate"  placeholder="0" min="0.01" step="0.01" /></td>
    <td class="veg-amt-cell" id="amt-${id}">₹0.00</td>
    <td><button type="button" class="btn-remove-row" onclick="removeVegRow(this)" title="Remove row">✕</button></td>
  `;

  // Live recalc on qty / rate change
  tr.querySelector(".veg-qty").addEventListener("input",  () => recalcRow(tr));
  tr.querySelector(".veg-rate").addEventListener("input", () => recalcRow(tr));

  tbody.appendChild(tr);
  refreshRowNumbers();
  updateRemoveButtons();
}

/* ---- Remove a vegetable row ---- */
function removeVegRow(btn) {
  const tr = btn.closest("tr");
  tr.remove();
  refreshRowNumbers();
  updateRemoveButtons();
  recalcGrandTotal();
}

/* ---- Renumber the # column after add/remove ---- */
function refreshRowNumbers() {
  document.querySelectorAll("#vegRowsBody tr").forEach((tr, i) => {
    tr.querySelector(".veg-row-num").textContent = i + 1;
  });
}

/* ---- Disable remove button when only 1 row remains ---- */
function updateRemoveButtons() {
  const rows = document.querySelectorAll("#vegRowsBody tr");
  rows.forEach(tr => {
    tr.querySelector(".btn-remove-row").disabled = rows.length === 1;
  });
}

/* ---- Recalculate amount for one row ---- */
function recalcRow(tr) {
  const qty   = parseFloat(tr.querySelector(".veg-qty").value)  || 0;
  const rate  = parseFloat(tr.querySelector(".veg-rate").value) || 0;
  const amt   = qty * rate;
  const id    = tr.dataset.rowId;
  document.getElementById("amt-" + id).textContent = formatCurrency(amt);
  recalcGrandTotal();
}

/* ---- Recalculate totals row + grand total display ---- */
function recalcGrandTotal() {
  let totalQty = 0;
  let grandTotal = 0;

  document.querySelectorAll("#vegRowsBody tr").forEach(tr => {
    const qty  = parseFloat(tr.querySelector(".veg-qty").value)  || 0;
    const rate = parseFloat(tr.querySelector(".veg-rate").value) || 0;
    totalQty   += qty;
    grandTotal += qty * rate;
  });

  document.getElementById("footTotalQty").textContent    = totalQty.toFixed(2) + " kg";
  document.getElementById("footGrandTotal").textContent  = formatCurrency(grandTotal);
  document.getElementById("totalAmountDisplay").textContent = formatCurrency(grandTotal);

  // Summary calc hint
  const rows = document.querySelectorAll("#vegRowsBody tr");
  document.getElementById("totalCalc").textContent =
    rows.length === 1
      ? (() => {
          const q = parseFloat(rows[0].querySelector(".veg-qty").value)  || 0;
          const r = parseFloat(rows[0].querySelector(".veg-rate").value) || 0;
          return (q > 0 && r > 0) ? `${q} kg × ₹${r}/kg` : "";
        })()
      : rows.length > 1
        ? `${rows.length} vegetables · ${totalQty.toFixed(2)} kg total`
        : "";
}

/* ---- Collect all veg rows into an items array ---- */
function collectVegItems() {
  const items = [];
  document.querySelectorAll("#vegRowsBody tr").forEach(tr => {
    const name = tr.querySelector(".veg-name").value.trim();
    const qty  = parseFloat(tr.querySelector(".veg-qty").value)  || 0;
    const rate = parseFloat(tr.querySelector(".veg-rate").value) || 0;
    items.push({ name, qty, rate, amount: qty * rate });
  });
  return items;
}

/* ---- Validate the whole form ---- */
function validateForm() {
  let valid = true;

  // Customer name
  const custEl = document.getElementById("customerName");
  if (!custEl.value.trim()) {
    custEl.classList.add("input-error");
    if (valid) { showToast("Please enter customer name.", "error"); custEl.focus(); }
    valid = false;
  } else { custEl.classList.remove("input-error"); }

  // Mobile (optional but must be 10 digits if filled)
  const mobile = document.getElementById("customerMobile").value.trim();
  if (mobile && !/^\d{10}$/.test(mobile)) {
    document.getElementById("customerMobile").classList.add("input-error");
    if (valid) showToast("Mobile number must be 10 digits.", "error");
    valid = false;
  } else { document.getElementById("customerMobile").classList.remove("input-error"); }

  // Veg rows
  let hasValidRow = false;
  document.querySelectorAll("#vegRowsBody tr").forEach(tr => {
    const nameEl = tr.querySelector(".veg-name");
    const qtyEl  = tr.querySelector(".veg-qty");
    const rateEl = tr.querySelector(".veg-rate");
    let rowOk = true;

    if (!nameEl.value.trim()) { nameEl.classList.add("input-error"); rowOk = false; }
    else                       { nameEl.classList.remove("input-error"); }

    if (!(parseFloat(qtyEl.value) > 0))  { qtyEl.classList.add("input-error");  rowOk = false; }
    else                                  { qtyEl.classList.remove("input-error"); }

    if (!(parseFloat(rateEl.value) > 0)) { rateEl.classList.add("input-error"); rowOk = false; }
    else                                  { rateEl.classList.remove("input-error"); }

    if (rowOk) hasValidRow = true;
    else valid = false;
  });

  if (!hasValidRow && valid === false) {
    showToast("Please fill all vegetable details (name, qty, rate).", "error");
  }

  return valid;
}

/* ---- Build bill data & show preview ---- */
function handleGenerateBill() {
  if (!validateForm()) return;

  const items     = collectVegItems();
  const grandTotal = items.reduce((s, i) => s + i.amount, 0);
  const totalQty   = items.reduce((s, i) => s + i.qty, 0);

  // Legacy fields kept for dashboard/history backward compat
  const firstItem = items[0];

  currentBillData = {
    id:        Date.now().toString(),
    invoiceNo: document.getElementById("invoiceNo").value,
    dateISO:   document.getElementById("billDate").dataset.iso || getTodayISO(),
    dateDisp:  document.getElementById("billDate").value,
    customer:  document.getElementById("customerName").value.trim(),
    mobile:    document.getElementById("customerMobile").value.trim(),
    // Multi-item array
    items,
    // Aggregates
    total:     grandTotal,
    qty:       totalQty,
    // Legacy single-veg fields (for history table display)
    vegName:   items.length === 1 ? firstItem.name : items.map(i => i.name).join(", "),
    price:     items.length === 1 ? firstItem.rate : 0,
  };

  renderInvoicePreview(currentBillData, "invoicePreview");
  document.getElementById("invoicePreviewCard").style.display = "block";
  document.getElementById("invoicePreviewCard").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Invoice generated! Review and save or download.");
}

/* ---- Reset form back to 1 blank row ---- */
function resetForm() {
  document.getElementById("customerName").value    = "";
  document.getElementById("customerMobile").value  = "";
  document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));

  // Clear veg rows and reset counter
  document.getElementById("vegRowsBody").innerHTML = "";
  vegRowCounter = 0;
  addVegRow();

  currentBillData = null;
  document.getElementById("invoicePreviewCard").style.display = "none";
  document.getElementById("totalAmountDisplay").textContent = "₹ 0.00";
  document.getElementById("totalCalc").textContent          = "";
  document.getElementById("footTotalQty").textContent       = "0 kg";
  document.getElementById("footGrandTotal").textContent     = "₹0.00";
  setInvoiceDefaults();
}


/* ============================================================
   INVOICE HTML BUILDER
   Returns the full invoice HTML string for a bill object.
   Supports both multi-item (items[]) and legacy single-veg bills.
   Used for preview, modal, and print.
   ============================================================ */
function buildInvoiceHTML(bill) {
  const mobileLine = bill.mobile
    ? `<div class="inv-cust-item"><span class="inv-cust-label">Mobile</span><span class="inv-cust-val">${bill.mobile}</span></div>`
    : "";

  // Support both new multi-item bills and legacy single-veg bills
  const items = bill.items
    ? bill.items
    : [{ name: bill.vegName, qty: bill.qty, rate: bill.price, amount: bill.total }];

  const totalQty   = items.reduce((s, i) => s + i.qty, 0);
  const grandTotal = items.reduce((s, i) => s + i.amount, 0);

  // Build item rows
  const itemRows = items.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${item.name}</td>
      <td class="text-right">${item.qty} kg</td>
      <td class="text-right">₹${item.rate.toFixed(2)}</td>
      <td class="text-right"><strong>₹${item.amount.toFixed(2)}</strong></td>
    </tr>`).join("");

  // Totals footer row — only show if more than 1 item
  const totalsRow = items.length > 1 ? `
    <tr style="background:#e8f5e9;font-weight:700;">
      <td colspan="2" style="padding:9px 14px;color:#1b5e20;">Total</td>
      <td class="text-right" style="padding:9px 14px;">${totalQty.toFixed(2)} kg</td>
      <td></td>
      <td class="text-right" style="padding:9px 14px;">₹${grandTotal.toFixed(2)}</td>
    </tr>` : "";

  return `
  <div class="invoice-box" id="printArea">
    <!-- Header -->
    <div class="inv-header">
      <div class="inv-farm-icon">🌾</div>
      <div class="inv-farm-name">${FARM.name}</div>
      <div class="inv-farm-tag">${FARM.tagline}</div>
      <div class="inv-farm-addr">📍 ${FARM.address} &nbsp;|&nbsp; 📞 ${FARM.phone}</div>
    </div>

    <!-- Invoice Meta -->
    <div class="inv-meta">
      <div class="inv-meta-item">
        <span class="inv-meta-label">Invoice No</span>
        <span class="inv-meta-val">${bill.invoiceNo}</span>
      </div>
      <div class="inv-meta-item">
        <span class="inv-meta-label">Date</span>
        <span class="inv-meta-val">${bill.dateDisp || formatDateDisplay(bill.dateISO)}</span>
      </div>
      <div class="inv-meta-item">
        <span class="inv-meta-label">Status</span>
        <span class="badge badge-green">✓ Paid</span>
      </div>
    </div>

    <!-- Customer -->
    <div class="inv-customer">
      <div class="inv-cust-item">
        <span class="inv-cust-label">Customer Name</span>
        <span class="inv-cust-val">${bill.customer}</span>
      </div>
      ${mobileLine}
    </div>

    <!-- Items Table -->
    <div class="inv-table-wrap">
      <table class="inv-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Vegetable / भाजी</th>
            <th class="text-right">Qty (kg)</th>
            <th class="text-right">Rate (₹/kg)</th>
            <th class="text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
        ${items.length > 1 ? `<tfoot>${totalsRow}</tfoot>` : ""}
      </table>
    </div>

    <!-- Grand Total -->
    <div class="inv-total-row">
      <span class="inv-total-label">Grand Total:</span>
      <span class="inv-total-val">${formatCurrency(grandTotal)}</span>
    </div>

    <!-- Footer -->
    <div class="inv-footer">
      <div>
        <div class="inv-thankyou">🙏 Thank You! Visit Again.</div>
        <div style="font-size:0.75rem;color:var(--text-light);margin-top:4px;">
          ${FARM.name} · ${FARM.address} · ${FARM.phone}
        </div>
      </div>
      <div class="inv-sig">
        <div class="inv-sig-line"></div>
        <div class="inv-sig-label">Authorized Signature</div>
      </div>
    </div>
  </div>`;
}

function renderInvoicePreview(bill, containerId) {
  document.getElementById(containerId).innerHTML = buildInvoiceHTML(bill);
}


/* ============================================================
   SAVE BILL
   ============================================================ */
function saveBillAndNew() {
  if (!currentBillData) return;
  addBill(currentBillData);
  showToast(`Bill ${currentBillData.invoiceNo} saved successfully! 🎉`);
  currentBillData = null;
  resetForm();
  renderDashboard();
}

/* ============================================================
   PRINT
   ============================================================ */
function printInvoice() {
  if (!currentBillData) return;
  triggerPrint(buildInvoiceHTML(currentBillData));
}

function printModalInvoice() {
  const bill = getBillById(modalBillId);
  if (!bill) return;
  triggerPrint(buildInvoiceHTML(bill));
}

function triggerPrint(invoiceHTML) {
  const win = window.open("", "_blank", "width=800,height=700");
  win.document.write(`
    <!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Invoice</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; }
      * { box-sizing: border-box; }
      .invoice-box { border: 2px solid #a5d6a7; border-radius: 12px; overflow: hidden; }
      .inv-header { background: linear-gradient(135deg,#1b5e20,#388e3c); color:#fff; text-align:center; padding:22px 24px; }
      .inv-farm-icon { font-size:2rem; margin-bottom:6px; display:block; }
      .inv-farm-name { font-size:1.3rem; font-weight:800; display:block; }
      .inv-farm-tag  { font-size:0.78rem; opacity:0.85; display:block; margin-top:2px; }
      .inv-farm-addr { font-size:0.82rem; opacity:0.9; margin-top:6px; display:block; }
      .inv-meta { display:flex; gap:20px; padding:12px 20px; background:#e8f5e9; border-bottom:1px solid #a5d6a7; font-size:0.82rem; flex-wrap:wrap; }
      .inv-meta-item { display:flex; flex-direction:column; gap:1px; }
      .inv-meta-label { font-size:0.7rem; color:#7a8e7a; text-transform:uppercase; font-weight:600; }
      .inv-meta-val   { font-weight:700; color:#1b5e20; }
      .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; }
      .badge-green { background:#e8f5e9; color:#1b5e20; }
      .inv-customer { padding:14px 20px; border-bottom:1px solid #d0e8d0; display:flex; gap:32px; font-size:0.85rem; flex-wrap:wrap; }
      .inv-cust-item { display:flex; flex-direction:column; gap:2px; }
      .inv-cust-label { font-size:0.7rem; color:#7a8e7a; text-transform:uppercase; font-weight:600; }
      .inv-cust-val   { font-weight:600; }
      .inv-table-wrap { padding:16px 20px; }
      .inv-table { width:100%; border-collapse:collapse; font-size:0.84rem; }
      .inv-table thead tr { background:#1b5e20; color:#fff; }
      .inv-table th { padding:10px 14px; text-align:left; font-weight:600; font-size:0.8rem; }
      .inv-table td { padding:10px 14px; border-bottom:1px solid #d0e8d0; }
      .text-right { text-align:right; }
      .inv-total-row { display:flex; justify-content:flex-end; padding:12px 20px; border-top:2px solid #a5d6a7; gap:20px; align-items:center; }
      .inv-total-label { font-size:1rem; font-weight:700; color:#4a5e4a; }
      .inv-total-val { font-size:1.4rem; font-weight:800; color:#1b5e20; background:#e8f5e9; padding:6px 16px; border-radius:8px; border:1.5px solid #a5d6a7; }
      .inv-footer { display:flex; justify-content:space-between; align-items:flex-end; padding:16px 20px; border-top:1px solid #d0e8d0; font-size:0.8rem; flex-wrap:wrap; gap:12px; }
      .inv-thankyou { font-weight:700; color:#1b5e20; font-size:0.9rem; }
      .inv-sig { text-align:center; }
      .inv-sig-line { width:120px; border-bottom:1.5px solid #1a2e1a; margin:0 auto 4px; height:28px; }
      .inv-sig-label { font-size:0.72rem; color:#7a8e7a; }
    </style></head><body>
    ${invoiceHTML}
    </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}


/* ============================================================
   PDF GENERATION — html2canvas + jsPDF
   Renders the invoice HTML to a canvas via html2canvas, then
   inserts the resulting image into an A4 jsPDF document.
   This approach preserves ALL text exactly as displayed:
   Marathi (Devanagari), Hindi, English, emojis, ₹ symbol.
   No Helvetica text rendering — everything is captured as pixels.
   ============================================================ */

/**
 * Core function: renders a bill object to a canvas, then
 * returns a jsPDF doc with the invoice image on an A4 page.
 * @param {object} bill - bill data object
 * @returns {Promise<jsPDF>}
 */
async function buildPDF(bill) {
  const { jsPDF } = window.jspdf;

  // 1. Build the invoice HTML string
  const html = buildInvoiceHTML(bill);

  // 2. Inject into the off-screen render container
  const container = document.getElementById("pdfRenderContainer");
  container.innerHTML = html;

  // 3. Small delay so the browser paints gradients, fonts, emojis
  await new Promise(r => setTimeout(r, 120));

  // 4. Capture with html2canvas at 2× scale for crisp output
  const canvas = await html2canvas(container.firstElementChild, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    // Ensure the full element height is captured
    windowWidth: 794,
  });

  // 5. Clean up the render container
  container.innerHTML = "";

  // 6. A4 dimensions in mm
  const A4_W = 210;
  const A4_H = 297;

  // 7. Calculate rendered image height in mm at full A4 width
  const imgAspect = canvas.height / canvas.width;
  let imgW = A4_W;
  let imgH = A4_W * imgAspect;

  // 8. If taller than A4, scale down to fit — never split across pages
  if (imgH > A4_H) {
    imgH = A4_H;
    imgW = A4_H / imgAspect;
  }

  // 9. Center on the page (horizontally and vertically)
  const xOffset = (A4_W - imgW) / 2;
  const yOffset = (A4_H - imgH) / 2;

  // 10. Single-page PDF — always one page regardless of invoice length
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const imgData = canvas.toDataURL("image/png");
  doc.addImage(imgData, "PNG", xOffset, yOffset, imgW, imgH);

  return doc;
}

/**
 * Download PDF for the bill currently previewed on the Create Bill page.
 */
async function downloadPDF() {
  if (!currentBillData) return;
  showToast("Generating PDF…");
  try {
    const doc = await buildPDF(currentBillData);
    doc.save(`${currentBillData.invoiceNo}.pdf`);
    showToast("PDF downloaded! ✅");
  } catch (err) {
    console.error("PDF generation failed:", err);
    showToast("PDF generation failed. Try again.", "error");
  }
}

/**
 * Download PDF for a bill opened in the history modal.
 */
async function downloadModalPDF() {
  const bill = getBillById(modalBillId);
  if (!bill) return;
  showToast("Generating PDF…");
  try {
    const doc = await buildPDF(bill);
    doc.save(`${bill.invoiceNo}.pdf`);
    showToast("PDF downloaded! ✅");
  } catch (err) {
    console.error("PDF generation failed:", err);
    showToast("PDF generation failed. Try again.", "error");
  }
}

/**
 * Also used by history page "Download PDF" button for any saved bill.
 */
async function downloadBillPDF(id) {
  const bill = getBillById(id);
  if (!bill) return;
  showToast("Generating PDF…");
  try {
    const doc = await buildPDF(bill);
    doc.save(`${bill.invoiceNo}.pdf`);
    showToast("PDF downloaded! ✅");
  } catch (err) {
    console.error("PDF generation failed:", err);
    showToast("PDF generation failed. Try again.", "error");
  }
}


/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  const bills   = getBills();
  const today   = getTodayISO();
  let revenue   = 0;
  let qty       = 0;
  let todaySales = 0;

  bills.forEach(b => {
    revenue += b.total;
    qty     += b.qty;
    if (b.dateISO === today) todaySales += b.total;
  });

  document.getElementById("totalBills").textContent   = bills.length;
  document.getElementById("totalRevenue").textContent = formatCurrency(revenue);
  document.getElementById("totalQty").textContent     = qty.toFixed(1) + " kg";
  document.getElementById("todaySales").textContent   = formatCurrency(todaySales);

  // Recent bills (latest 5)
  const tbody = document.getElementById("recentBillsBody");
  if (bills.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">No bills yet. <a href="#" onclick="navigateTo('create-bill')">Create your first bill</a></td></tr>`;
    return;
  }
  tbody.innerHTML = bills.slice(0, 5).map(b => `
    <tr>
      <td><span class="badge badge-green">${b.invoiceNo}</span></td>
      <td>${b.customer}</td>
      <td>${b.vegName || (b.items ? b.items.map(i => i.name).join(", ") : "-")}</td>
      <td>${(b.qty || 0).toFixed(1)} kg</td>
      <td><strong>${formatCurrency(b.total)}</strong></td>
      <td>${b.dateDisp || formatDateDisplay(b.dateISO)}</td>
    </tr>`).join("");
}

/* ============================================================
   BILL HISTORY
   ============================================================ */
function renderHistory(filtered = null) {
  const bills = filtered !== null ? filtered : getBills();
  const tbody = document.getElementById("historyTableBody");

  if (bills.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-msg">No bills found.</td></tr>`;
    updateFilterSummary(0, getBills().length);
    return;
  }

  updateFilterSummary(bills.length, getBills().length);

  tbody.innerHTML = bills.map(b => {
    const vegDisplay  = b.vegName || (b.items ? b.items.map(i => i.name).join(", ") : "-");
    const qtyDisplay  = (b.qty || 0).toFixed(2) + " kg";
    const rateDisplay = b.items && b.items.length > 1
      ? `${b.items.length} items`
      : b.price
        ? `₹${b.price.toFixed(2)}`
        : (b.items ? `₹${b.items[0].rate.toFixed(2)}` : "-");
    return `
    <tr>
      <td><span class="badge badge-green">${b.invoiceNo}</span></td>
      <td>${b.customer}</td>
      <td>${b.mobile || "-"}</td>
      <td>${vegDisplay}</td>
      <td>${qtyDisplay}</td>
      <td>${rateDisplay}</td>
      <td><strong>${formatCurrency(b.total)}</strong></td>
      <td>${b.dateDisp || formatDateDisplay(b.dateISO)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" title="View / Reprint" onclick="openBillModal('${b.id}')">👁️</button>
          <button class="btn-icon" title="Download PDF" onclick="downloadBillPDF('${b.id}')">⬇️</button>
          <button class="btn-icon" title="Delete" onclick="confirmDeleteBill('${b.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function updateFilterSummary(shown, total) {
  const el = document.getElementById("filterSummary");
  if (shown === total) {
    el.textContent = `Showing all ${total} bill${total !== 1 ? "s" : ""}.`;
  } else {
    el.textContent = `Showing ${shown} of ${total} bill${total !== 1 ? "s" : ""}.`;
  }
}

/* ---- Search & Date Filter ---- */
function filterBills() {
  const query    = document.getElementById("searchInput").value.toLowerCase().trim();
  const fromVal  = document.getElementById("filterFrom").value;
  const toVal    = document.getElementById("filterTo").value;

  let bills = getBills();

  if (query) {
    bills = bills.filter(b => {
      const vegStr = b.vegName
        || (b.items ? b.items.map(i => i.name).join(" ").toLowerCase() : "");
      return (
        b.invoiceNo.toLowerCase().includes(query) ||
        b.customer.toLowerCase().includes(query)  ||
        vegStr.toLowerCase().includes(query)      ||
        (b.mobile && b.mobile.includes(query))
      );
    });
  }
  if (fromVal) bills = bills.filter(b => b.dateISO >= fromVal);
  if (toVal)   bills = bills.filter(b => b.dateISO <= toVal);

  renderHistory(bills);
}

function clearFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("filterFrom").value  = "";
  document.getElementById("filterTo").value    = "";
  renderHistory();
}

/* ---- Action helpers ---- */

function confirmDeleteBill(id) {
  const bill = getBillById(id);
  if (!bill) return;
  if (confirm(`Delete bill ${bill.invoiceNo} for ${bill.customer}? This cannot be undone.`)) {
    deleteBillById(id);
    renderHistory();
    renderDashboard();
    showToast("Bill deleted.", "warn");
  }
}


/* ============================================================
   MODAL — View / Reprint existing bill
   ============================================================ */
function openBillModal(id) {
  const bill = getBillById(id);
  if (!bill) return;
  modalBillId = id;
  renderInvoicePreview(bill, "modalInvoiceContent");
  document.getElementById("modalOverlay").classList.add("open");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  modalBillId = null;
}

function deleteCurrentBill() {
  if (!modalBillId) return;
  const bill = getBillById(modalBillId);
  if (!bill) return;
  if (confirm(`Delete bill ${bill.invoiceNo}? This cannot be undone.`)) {
    deleteBillById(modalBillId);
    closeModal();
    renderHistory();
    renderDashboard();
    showToast("Bill deleted.", "warn");
  }
}

/* ============================================================
   TOAST NOTIFICATION
   ============================================================ */
function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast show" + (type === "error" ? " toast-error" : type === "warn" ? " toast-warn" : "");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

/* ============================================================
   UTILITY
   ============================================================ */
function formatCurrency(amount) {
  return "₹" + amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
