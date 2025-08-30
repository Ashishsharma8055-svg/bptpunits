import { apiGet, apiPost, escapeHtml, toast } from './app.js';

const loginPanel = document.getElementById('loginPanel');
const adminPanel = document.getElementById('adminPanel');

document.getElementById('loginBtn').addEventListener('click', async ()=>{
  try{
    const u = document.getElementById('u').value.trim();
    const p = document.getElementById('p').value.trim();
    const admins = await apiGet({ type: 'admins' });
    const ok = (admins||[]).some(a => (a['Username']||'')===u && (a['Password']||'')===p);
    if(ok){ loginPanel.style.display='none'; adminPanel.style.display='block'; loadAll(); }
    else toast('Invalid credentials', false);
  }catch(e){ toast('Login error', false); }
});

// Add Project
document.getElementById('addProjectBtn').addEventListener('click', async ()=>{
  const body = {
    projectName: document.getElementById('ap_name').value.trim(),
    location: document.getElementById('ap_loc').value.trim(),
    productMix: document.getElementById('ap_mix').value.trim(),
    budgetRange: document.getElementById('ap_budget').value.trim(),
    brochureURL: document.getElementById('ap_brochure').value.trim(),
    videoURL: document.getElementById('ap_video').value.trim(),
    photoUrls: [
      document.getElementById('ap_p1').value.trim(),
      document.getElementById('ap_p2').value.trim(),
      document.getElementById('ap_p3').value.trim(),
      document.getElementById('ap_p4').value.trim(),
    ].filter(Boolean)
  };
  if(!body.projectName){ toast('Project Name required', false); return; }
  try{ 
    const res = await apiPost('addproject', body);
    toast(res&&res.success ? 'Added' : 'Failed', !!(res&&res.success));
    loadProjectsTable();
  }catch(e){ toast('Add project error', false); }
});

// Add Inventory
document.getElementById('addInvBtn').addEventListener('click', async ()=>{
  const body = {
    projectName: document.getElementById('ai_project').value.trim(),
    unitNumber: document.getElementById('ai_unit').value.trim(),
    propertyType: document.getElementById('ai_type').value.trim(),
    propertyStatus: document.getElementById('ai_status').value.trim(),
    size: document.getElementById('ai_size').value.trim(),
    budget: document.getElementById('ai_budget').value.trim(),
    possession: document.getElementById('ai_poss').value.trim(),
    paymentPlan: document.getElementById('ai_pay').value.trim()
  };
  if(!body.projectName || !body.unitNumber){ toast('Project & Unit required', false); return; }
  try{ 
    const res = await apiPost('addinventory', body);
    toast(res&&res.success ? 'Added' : 'Failed', !!(res&&res.success));
    loadInventoryTable();
  }catch(e){ toast('Add inventory error', false); }
});

// CSV Preview & Save
let csvRows = [];
document.getElementById('parseCsvBtn').addEventListener('click', ()=>{
  const f = document.getElementById('csvFile').files[0];
  if(!f){ toast('Choose CSV', false); return; }
  const r = new FileReader();
  r.onload = ()=>{
    const lines = r.result.split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<=1){ toast('CSV empty', false); return; }
    const headers = lines[0].split(',').map(h=>h.trim());
    csvRows = lines.slice(1).map(l=>{
      const cells=l.split(',');
      const o={}; headers.forEach((h,i)=>o[h]=(cells[i]||'').trim());
      return o;
    });
    renderCsvPreview(headers, csvRows);
    document.getElementById('saveCsvBtn').disabled = false;
  };
  r.readAsText(f);
});

document.getElementById('saveCsvBtn').addEventListener('click', async ()=>{
  if(!csvRows.length){ toast('Nothing to save', false); return; }
  try{
    const res = await apiPost('bulkaddinventory', { rows: csvRows });
    toast(res&&res.success ? 'Saved' : 'Failed', !!(res&&res.success));
    if(res && res.success){
      csvRows=[]; document.getElementById('csvPreview').innerHTML=''; 
      document.getElementById('saveCsvBtn').disabled=true; 
      loadInventoryTable();
    }
  }catch(e){ toast('CSV save error', false); }
});

function renderCsvPreview(headers, rows){
  const wrap = document.getElementById('csvPreview');
  wrap.innerHTML = `<table class="table"><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r=>`<tr>${headers.map(h=>`<td contenteditable data-key="${escapeHtml(h)}">${escapeHtml(r[h]||'')}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
  wrap.querySelectorAll('td[contenteditable]').forEach(td=> 
    td.addEventListener('input', ()=>{
      const tr = td.parentElement; 
      const idx = [...tr.parentElement.children].indexOf(tr); 
      csvRows[idx][td.dataset.key] = td.textContent;
    })
  );
}

// Tables (Projects, Inventory)
async function loadProjectsTable(){
  try{
    const list = await apiGet({ type: 'projects' });
    const wrap = document.getElementById('projTable');
    if(!list.length){ wrap.innerHTML = '<div class="small">No projects</div>'; return; }
    wrap.innerHTML = `<table class="table"><thead><tr><th>Name</th><th>Location</th><th>Mix</th><th>Budget</th><th></th></tr></thead><tbody>${
      list.map(p=>`<tr>
        <td contenteditable data-key="Project Name">${escapeHtml(p['Project Name']||'')}</td>
        <td contenteditable data-key="Location">${escapeHtml(p['Location']||'')}</td>
        <td contenteditable data-key="Product Mix">${escapeHtml(p['Product Mix']||'')}</td>
        <td contenteditable data-key="Budget Range">${escapeHtml(p['Budget Range']||'')}</td>
        <td><button class="btn save">Save</button> <button class="btn secondary del">Delete</button></td>
      </tr>`).join('')
    }</tbody></table>`;

    wrap.querySelectorAll('.save').forEach(btn => btn.addEventListener('click', async ()=>{
      const tr = btn.closest('tr'); 
      const cells = [...tr.querySelectorAll('td[contenteditable]')];
      const fields = Object.fromEntries(cells.map(td=>[td.dataset.key, td.textContent]));
      const id = fields['Project Name'];
      try{ 
        const res = await apiPost('updateproject', { id, fields });
        toast(res&&res.success ? 'Saved' : 'Failed', !!(res&&res.success));
        loadProjectsTable();
      }catch(e){ toast('Save error', false); }
    }));

    wrap.querySelectorAll('.del').forEach(btn => btn.addEventListener('click', async ()=>{
      const tr = btn.closest('tr'); 
      const id = tr.querySelector('td[data-key="Project Name"]').textContent;
      if(!confirm('Delete project?')) return;
      try{
        const res = await apiPost('deleteproject', { id });
        toast(res&&res.success ? 'Deleted' : 'Failed', !!(res&&res.success));
        loadProjectsTable();
      }catch(e){ toast('Delete error', false); }
    }));
  }catch(e){
    document.getElementById('projTable').innerHTML = '<div class="small">Error loading projects</div>';
  }
}

async function loadInventoryTable(){
  try{
    const filter = document.getElementById('invFilter').value.trim();
    const list = filter ? await apiGet({ type: 'inventory', project: filter }) : await apiGet({ type: 'inventory' });
    const wrap = document.getElementById('invTable');
    if(!list.length){ wrap.innerHTML = '<div class="small">No inventory</div>'; return; }
    wrap.innerHTML = `<table class="table"><thead><tr><th>Project</th><th>Unit</th><th>Type</th><th>Status</th><th>Size</th><th>Budget</th><th>Possession</th><th>Payment Plan</th><th></th></tr></thead><tbody>${
      list.map(r=>`<tr>
        <td contenteditable data-key="Project Name">${escapeHtml(r['Project Name']||'')}</td>
        <td contenteditable data-key="Unit Number">${escapeHtml(r['Unit Number']||'')}</td>
        <td contenteditable data-key="Property Type">${escapeHtml(r['Property Type']||'')}</td>
        <td contenteditable data-key="Property Status">${escapeHtml(r['Property Status']||'')}</td>
        <td contenteditable data-key="Size">${escapeHtml(r['Size']||'')}</td>
        <td contenteditable data-key="Budget">${escapeHtml(r['Budget']||'')}</td>
        <td contenteditable data-key="Possession">${escapeHtml(r['Possession']||'')}</td>
        <td contenteditable data-key="Payment Plan">${escapeHtml(r['Payment Plan']||'')}</td>
        <td><button class="btn save">Save</button> <button class="btn secondary del">Delete</button></td>
      </tr>`).join('')
    }</tbody></table>`;

    wrap.querySelectorAll('.save').forEach(btn => btn.addEventListener('click', async ()=>{
      const tr = btn.closest('tr'); 
      const cells = [...tr.querySelectorAll('td[contenteditable]')];
      const fields = Object.fromEntries(cells.map(td=>[td.dataset.key, td.textContent]));
      try{
        const res = await apiPost('updateinventory', { 
          match: { 'Project Name': fields['Project Name'], 'Unit Number': fields['Unit Number'] }, 
          fields 
        });
        toast(res&&res.success ? 'Saved' : 'Failed', !!(res&&res.success));
        loadInventoryTable();
      }catch(e){ toast('Save error', false); }
    }));

    wrap.querySelectorAll('.del').forEach(btn => btn.addEventListener('click', async ()=>{
      if(!confirm('Delete row?')) return;
      const tr = btn.closest('tr'); 
      const cells = [...tr.querySelectorAll('td[contenteditable]')];
      const fields = Object.fromEntries(cells.map(td=>[td.dataset.key, td.textContent]));
      try{
        const res = await apiPost('deleteinventory', { 
          match: { 'Project Name': fields['Project Name'], 'Unit Number': fields['Unit Number'] } 
        });
        toast(res&&res.success ? 'Deleted' : 'Failed', !!(res&&res.success));
        loadInventoryTable();
      }catch(e){ toast('Delete error', false); }
    }));
  }catch(e){
    document.getElementById('invTable').innerHTML = '<div class="small">Error loading inventory</div>';
  }
}

function loadAll(){ loadProjectsTable(); loadInventoryTable(); }
document.getElementById('invFilter').addEventListener('input', ()=> loadInventoryTable());