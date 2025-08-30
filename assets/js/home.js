// assets/js/home.js
import { apiGet, escapeHtml } from './app.js';

async function loadProjects(){
  const grid = document.getElementById('projectsGrid');
  grid.innerHTML = '<div class="small">Loading projects…</div>';
  try{
    const list = await apiGet({ type: 'projects' });
    if(!Array.isArray(list) || list.length===0){ grid.innerHTML = '<div class="small">No projects found.</div>'; return; }
    grid.innerHTML = list.map(p=>{
      const name = p['Project Name'] || '';
      const loc = p['Location'] || '';
      const img = p['Photo URL 1'] || p['Photo'] || 'https://picsum.photos/seed/realestate/600/400';
      return `<a class="tile" href="project.html?name=${encodeURIComponent(name)}">
        <img src="${escapeHtml(img)}" alt=""/>
        <div class="meta"><div class="name">${escapeHtml(name)}</div><div class="line">${escapeHtml(loc)}</div></div>
      </a>`;
    }).join('');
  }catch(err){
    grid.innerHTML = '<div class="small">Failed to load projects.</div>';
    console.error(err);
  }
}
loadProjects();
