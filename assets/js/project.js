// assets/js/project.js
import { apiGet, escapeHtml, qs } from './app.js';

const name = qs('name');
const host = document.getElementById('projectWrap');

async function init(){
  host.innerHTML = '<div class="small">Loading…</div>';
  try{
    const list = await apiGet({ type: 'projects' });
    const p = (list||[]).find(x => x['Project Name'] === name) || list[0];
    if(!p){ host.innerHTML = '<div class="small">Project not found.</div>'; return; }
    const photos = [p['Photo URL 1'],p['Photo URL 2'],p['Photo URL 3'],p['Photo URL 4']].filter(Boolean);
    host.innerHTML = `
      <div class="headline">
        <div>
          <h2>${escapeHtml(p['Project Name']||'')}</h2>
          <div class="small">${escapeHtml(p['Location']||'')} • ${escapeHtml(p['Product Mix']||'')}</div>
          <div style="margin-top:8px">${escapeHtml(p['Description']||'')}</div>
        </div>
        <div class="actions">
          ${p['Brochure URL']? `<a class="btn secondary" href="${escapeHtml(p['Brochure URL'])}" download>Download Brochure</a>`:''}
          ${p['Video URL']? `<a class="btn" href="${escapeHtml(p['Video URL'])}" target="_blank">Play Video</a>`:''}
          <a class="btn" href="inventory.html?project=${encodeURIComponent(p['Project Name'])}">View Inventory</a>
        </div>
      </div>
      ${photos.length? `<div class="gallery">${photos.map(s=>`<img src="${escapeHtml(s)}">`).join('')}</div>`:''}
    `;
  }catch(err){
    host.innerHTML = '<div class="small">Failed to load.</div>';
    console.error(err);
  }
}
init();
