// >>> Set your GAS Web App /exec URL here (yours from message)
export const GAS_BASE_URL = "https://script.google.com/macros/s/AKfycbwvXjRgF1kFZBXxfSTOhMvY0Gw1sI_cl41ZrubUFF0uo6QJHo7LBdZ-ZnJszLxmAmyI/exec";

function withTimeout(run, ms=12000){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), ms);
  return run(ctrl.signal).finally(()=>clearTimeout(t));
}

async function fetchJson(url, opts={}, retries=1){
  const runner = (signal)=>fetch(url, { cache:"no-store", ...opts, signal }).then(async res=>{
    const text = await res.text();
    if(!res.ok) throw new Error(`${res.status} ${text}`);
    try{ return JSON.parse(text); }catch{ throw new Error(`Bad JSON: ${text.slice(0,200)}`); }
  });
  try{
    return await withTimeout(runner, 12000);
  }catch(e){
    if(retries>0) return fetchJson(url, opts, retries-1);
    throw e;
  }
}

export async function apiGet(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${GAS_BASE_URL}?${qs}`;
  return fetchJson(url, {}, 1);
}

// IMPORTANT: text/plain avoids CORS preflight with Apps Script
export async function apiPost(action, body = {}) {
  const url = `${GAS_BASE_URL}?action=${encodeURIComponent(action)}`;
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  }, 0);
}

export function toast(msg, ok = true) {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed", right: "16px", bottom: "16px", zIndex: 99999,
    background: ok ? "#2ecc71" : "#ff6b6b", color: "#fff",
    padding: "10px 14px", borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,.35)", fontWeight: 700
  });
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 3500);
}

export function escapeHtml(s){ if(s==null) return ""; return (""+s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function qs(name){ return new URLSearchParams(location.search).get(name) || ""; }

// === Global Loader Wrappers ===
if(typeof window.apiGet === "function"){
  const originalApiGet = window.apiGet;
  window.apiGet = function(...args){
    showLoader();
    return originalApiGet(...args).finally(() => hideLoader());
  };
}

if(typeof window.fetch === "function"){
  const originalFetch = window.fetch;
  window.fetch = function(...args){
    showLoader();
    return originalFetch(...args).finally(() => hideLoader());
  };
}
// === End Loader Wrappers ===

