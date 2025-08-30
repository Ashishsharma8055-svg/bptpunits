import { apiPost, qs, toast } from './app.js';

const project = qs('project'); 
const unit    = qs('unit');

document.getElementById('project').value = project || '';
document.getElementById('unit').value    = unit || '';

const isAgentEl = document.getElementById('isAgent');
const statusEl  = document.getElementById('status');

document.getElementById('closeBtn').addEventListener('click',()=>window.close());
isAgentEl.addEventListener('change',()=>{
  const lab=isAgentEl.parentElement.querySelector('.label');
  lab.textContent=isAgentEl.checked?'Yes':'No';
});

function detectDeviceType(){
  const ua = (navigator.userAgent || '').toLowerCase();
  if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(ua)) return 'Mobile';
  if (/ipad|tablet|android(?!.*mobile)/.test(ua)) return 'Tablet';
  return 'Desktop';
}

async function getIP(){ 
  try{ const r=await fetch('https://api.ipify.org?format=json'); const j=await r.json(); return j.ip||''; }
  catch(e){ return ''; } 
}

document.getElementById('leadForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const name   = document.getElementById('name').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  //const city   = document.getElementById('city').value.trim();
  //const company= document.getElementById('company').value.trim();
  const isAgent= isAgentEl.checked?'Yes':'No';

  if(!name || !/^\d{6,15}$/.test(mobile)){ statusEl.textContent='Please provide valid Name and Mobile without "+91"'; return; }

  statusEl.textContent='Submitting…';
  const timezone   = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const deviceType = detectDeviceType();
  const ip         = await getIP();

  
  
  
  //const payload={ isAgent, name, mobile, city, company, timezone, ip, deviceType, project, unit };
const payload={ isAgent, name, mobile, timezone, ip, deviceType, project, unit };


  try{
    const res = await apiPost('addlead', payload);
    if(res && (res.success===true || !res.error)){
      if (res.blocked === true) {
        statusEl.textContent='Blocked';
        toast('Blocked', false);
        try{
          if(window.opener && !window.opener.closed){
            window.opener.postMessage({type:'leadSaved', project, unit, blocked:true}, '*');
            window.opener.focus();
          }
        }catch(e){}
        setTimeout(()=>window.close(), 1000);
        return;
      }
      statusEl.textContent='Saved ✓';
      try{ 
        if(window.opener && !window.opener.closed){ 
          window.opener.postMessage({type:'leadSaved', project, unit, blocked:false}, '*'); 
          window.opener.focus();
        } 
      }catch(e){}
      setTimeout(()=>window.close(), 800);
    }else{
      statusEl.textContent='Save failed'; toast('Lead save failed', false); console.error(res);
    }
  }catch(err){
    statusEl.textContent='Error'; toast('Error saving lead', false); console.error(err);
  }
});