import { apiGet, escapeHtml, qs, toast } from './app.js';

const mobileDownloadPdfBtn = document.getElementById('mobileDownloadPdfBtn');// sticky button
const projectSelect        = document.getElementById('projectSelect');
const inventoryBody        = document.getElementById('inventoryBody');
const noData               = document.getElementById('noData');
const refreshBtn           = document.getElementById('refreshBtn');
const downloadPdfBtn       = document.getElementById('downloadPdfBtn');      // header button (desktop only)
const mobileDownloadBar    = document.getElementById('mobileDownloadBar');   // sticky bar (mobile only)
//const mobileDownloadPdfBtn = document.getElementById('mobileDownloadPdfBtn');// sticky button

// Session-only unlock (clears on reload)
const unlockedProjectsSession = new Set();

// Store last-loaded rows (for sorting)
let __allRowsRaw = [];

// ===== Sort UI (auto-inject if missing) =====
function __ensureSortBar(){
  const existing = document.getElementById('unitSort') || document.getElementById('sizeSort');
  if (existing) return; // already present

  const tableWrap = document.querySelector('.table-wrap');
  if (!tableWrap) return;

  const bar = document.createElement('div');
  bar.className = 'sort-controls card';
  bar.style.margin = '12px 0';
  bar.style.padding = '12px';
  bar.style.display = 'flex';
  bar.style.gap = '12px';
  bar.style.flexWrap = 'wrap';
  bar.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:4px; min-width:200px">
      <label for="unitSort" class="small">Sort by Unit Number</label>
      <select id="unitSort" class="input">
        <option value="">None</option>
        <option value="asc">A → Z</option>
        <option value="desc">Z → A</option>
      </select>
    </div>
    <div style="display:flex; flex-direction:column; gap:4px; min-width:200px">
      <label for="sizeSort" class="small">Sort by Size</label>
      <select id="sizeSort" class="input">
        <option value="">None</option>
        <option value="asc">Low → High</option>
        <option value="desc">High → Low</option>
      </select>
    </div>
    <div style="display:flex; align-items:flex-end">
      <button id="resetSort" class="btn secondary" type="button">Reset</button>
    </div>
  `;
  tableWrap.parentNode.insertBefore(bar, tableWrap);
}

// ===== Helpers =====
function showLoadingRow(msg='Loading…'){
  inventoryBody.innerHTML = `<tr><td colspan="7"><span class="loading-dots">${escapeHtml(msg)}</span></td></tr>`;
}

// Warm-up (non-blocking)
async function warmup(){ try{ await apiGet({ type:'ping' }); }catch(e){} }

// Load projects
async function loadProjects(){
  projectSelect.innerHTML = '<option>Loading…</option>';
  const list = await apiGet({ type:'projects' });
  if(!list || !list.length){
    projectSelect.innerHTML = '<option disabled>No projects</option>';
    return;
  }
  projectSelect.innerHTML = list.map(p => `<option>${escapeHtml(p['Project Name'] || '')}</option>`).join('');
  const initial = qs('project');
  if (initial && list.some(p => p['Project Name'] === initial)) {
    projectSelect.value = initial;
  } else if (!projectSelect.value) {
    projectSelect.selectedIndex = 0;
  }
}

// ----- Sorting helpers -----
function __numParse(x){
  if(x==null) return null;
  const n = parseFloat(String(x).replace(/[₹$,]/g,'').replace(/[^\d.\-]/g,''));
  return isNaN(n) ? null : n;
}

function __applySort(rows){
  const unitSort = (document.getElementById('unitSort')?.value || '').toLowerCase();
  const sizeSort = (document.getElementById('sizeSort')?.value || '').toLowerCase();

  let out = rows.slice();

  // Primary: Size (if selected)
  if(sizeSort){
    out.sort((a,b)=>{
      const sa = __numParse(a['Size'] || a['Unit Size'] || '');
      const sb = __numParse(b['Size'] || b['Unit Size'] || '');
      // Put nulls at the end
      if (sa==null && sb==null) return 0;
      if (sa==null) return 1;
      if (sb==null) return -1;
      const cmp = sa - sb;
      return sizeSort === 'asc' ? cmp : -cmp;
    });
  }
  // Secondary: Unit (if selected)
  if(unitSort){
    out.sort((a,b)=>{
      const ua = String((a['Unit Number'] || a['Unit No'] || a['Unit'] || '')).toLowerCase();
      const ub = String((b['Unit Number'] || b['Unit No'] || b['Unit'] || '')).toLowerCase();
      if(ua<ub) return unitSort==='asc' ? -1 : 1;
      if(ua>ub) return unitSort==='asc' ? 1 : -1;
      return 0;
    });
  }
  return out;
}

function __bindSortUI(){
  const unitSel = document.getElementById('unitSort');
  const sizeSel = document.getElementById('sizeSort');
  const resetBtn = document.getElementById('resetSort');
  const rerender = ()=>{ __renderWithCurrentSort(); };
  unitSel?.addEventListener('change', rerender);
  sizeSel?.addEventListener('change', rerender);
  resetBtn?.addEventListener('click', ()=>{
    if(unitSel) unitSel.value='';
    if(sizeSel) sizeSel.value='';
    __renderWithCurrentSort();
  });
}

// Renders rows respecting unlock/blur logic
function __renderRows(rows, isUnlocked){
  if(!rows || !rows.length){
    inventoryBody.innerHTML = '';
    noData.textContent = 'No inventory for selected project.';
    noData.style.display = 'block';
    return;
  }

  noData.style.display = 'none';

  inventoryBody.innerHTML = rows.map(r => {
    const projectName = r['Project Name'] || '';
    const projectType = r['Property Type'] || r['Project Type'] || '';
    const unit        = r['Unit Number'] || r['Unit No'] || r['Unit'] || '';
    const size        = r['Size'] || r['Unit Size'] || '';
    const budget      = r['Budget'] || r['Price'] || '';
    const status      = r['Property Status'] || r['Status'] || '';
    const payplan      = r['Payment Plan'] || r['Pay Plan'] || '';



    const unitCell = isUnlocked ? escapeHtml(unit) : `<span class="blur">${escapeHtml(unit || '-')}</span>`;
    const sizeCell = isUnlocked ? escapeHtml(size) : `<span class="blur">${escapeHtml(size || '-')}</span>`;
    const budCell  = isUnlocked ? escapeHtml(budget) : `<span class="blur">${escapeHtml(budget || '-')}</span>`;

    const actionBtn = isUnlocked
      ? `<span class="small">Unlocked</span>`
      : `<button class="btn show-btn" data-project="${escapeHtml(projectName)}" data-unit="${escapeHtml(unit)}" type="button">SHOW</button>`;

    return `<tr>
      <td>${actionBtn}</td>  
      <td>${escapeHtml(projectName)}</td>
      <td>${escapeHtml(projectType)}</td>
      <td>${unitCell}</td>
      <td>${sizeCell}</td>
      <td>${budCell}</td>
      <td>${escapeHtml(status)}</td>
      <td>${escapeHtml(payplan)}</td>
    </tr>`;
  }).join('');

  if(!isUnlocked){
    // SHOW opens popup lead.html
    document.querySelectorAll('button.show-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.project;
        const u = btn.dataset.unit;
        const url = `lead.html?project=${encodeURIComponent(p)}&unit=${encodeURIComponent(u)}`;
        const w=680,h=720,left=(screen.width-w)/2,top=(screen.height-h)/2;
        const child = window.open(url, "lead_capture", `width=${w},height=${h},left=${left},top=${top}`);
        if(!child) alert('Popup blocked — please allow popups');
      });
    });
  } else {
    showDownloads(); // already unlocked this session
  }
}

function __renderWithCurrentSort(){
  const project = projectSelect.value || '';
  const isUnlocked = unlockedProjectsSession.has(project);
  const rows = __applySort(__allRowsRaw);
  __renderRows(rows, isUnlocked);
}

// Load inventory for selected project
async function loadInventory(){
  const project = projectSelect.value;
  hideDownloads(); // always hide at start

  if(!project){
    inventoryBody.innerHTML = '';
    noData.style.display='block'; noData.textContent='Select a project.';
    return;
  }

  showLoadingRow('Loading inventory…');
  noData.style.display = 'none';

  let rows;
  try{
    rows = await apiGet({ type:'inventory', project });
  }catch(err){
    inventoryBody.innerHTML = '';
    noData.textContent = 'Failed to load inventory. Click Refresh.';
    noData.style.display = 'block';
    toast('Network slow or GAS unavailable', false);
    return;
  }
  
  if(!rows || !rows.length){
    inventoryBody.innerHTML = '';
    noData.textContent = 'No inventory for selected project.';
    noData.style.display = 'block';
    return;
  }

  // Save and render with current sort selections
  __allRowsRaw = rows;
  __renderWithCurrentSort();
}

// Receive result AFTER lead capture (popup posts a message)
window.addEventListener('message', ev => {
  if(!ev.data || ev.data.type !== 'leadSaved') return;
  const project = String(ev.data.project || '');
  if(!project) return;

  if (ev.data.blocked === true) {
    toast('Blocked', false);   // Do NOT unlock if blocked
    return;
  }
  // Successful & not blocked → unlock entire project (session-only)
  unlockedProjectsSession.add(project);
  loadInventory().then(showDownloads);
});

// ----- Download visibility helpers (respect screen size) -----
function showDownloads(){
  const isSmall = window.matchMedia('(max-width: 640px)').matches;

  if (isSmall) {
    // Small screens: show sticky bar only
    if (mobileDownloadBar) mobileDownloadBar.style.display = 'flex';
    if (downloadPdfBtn)    downloadPdfBtn.style.display    = 'none';
  } else {
    // Large screens: show header button, hide sticky bar
    if (downloadPdfBtn)    downloadPdfBtn.style.display    = 'inline-block';
    if (mobileDownloadBar) mobileDownloadBar.style.display = 'none';
  }
}
function hideDownloads(){
  if (downloadPdfBtn)    downloadPdfBtn.style.display    = 'none';
  if (mobileDownloadBar) mobileDownloadBar.style.display = 'none';
}

// Re-apply visibility on resize (if unlocked)
window.addEventListener('resize', () => {
  const project = projectSelect.value;
  if (unlockedProjectsSession.has(project)) {
    showDownloads();
  }
});

// PDF export (print-friendly)
function exportVisibleTableToPDF(){
  const project = projectSelect.value || 'Project';
  //const headers = ['Project Name','Project Type','Unit Number','Size','Budget','Status'];
const headers = ['Project Type','Unit Number','Size','Budget','Status','PayPlan'];

  const rows = [...inventoryBody.querySelectorAll('tr')].map(tr => {
    const tds = [...tr.querySelectorAll('td')];
    if (tds.length < 6) return null;
    const cellText = idx => (tds[idx]?.textContent || '').trim();
    //return [cellText(0), cellText(1), cellText(2), cellText(3), cellText(4), cellText(5)];
    return [ cellText(2), cellText(3), cellText(4), cellText(5),cellText(6),cellText(7)];

  }).filter(Boolean);


  const tableHtml = `
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>${project} Inventory</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; }
          h2 { margin: 0 0 12px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; text-align: left; }
          thead th { background: #f2f2f2; }
          @media print { @page { size: A4 landscape; margin: 12mm; } button { display:none; } }
        </style>
      </head>
      <body>
        <h2>${project} — Inventory</h2>
        <table>
          <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <button onclick="window.print()">Print / Save as PDF</button>
      </body>
    </html>
  `;
  const w = window.open('', '_blank', 'width=1100,height=760');
  w.document.open(); w.document.write(tableHtml); w.document.close();
  setTimeout(()=>{ try{ w.print(); }catch(e){} }, 300);
}

// Wire both desktop and mobile buttons
downloadPdfBtn?.addEventListener('click', exportVisibleTableToPDF);
mobileDownloadPdfBtn?.addEventListener('click', exportVisibleTableToPDF);

// Change + refresh
projectSelect.addEventListener('change', ()=>{ showLoadingRow('Loading inventory…'); loadInventory(); });
refreshBtn?.addEventListener('click', ()=>{ showLoadingRow('Refreshing…'); loadInventory(); });

// init
(async function init(){
  warmup();
  __ensureSortBar();
  try{ await loadProjects(); }catch(e){
    inventoryBody.innerHTML=''; noData.textContent='Failed to load projects.'; noData.style.display='block';
    return;
  }
  await loadInventory();
  __bindSortUI();
})();