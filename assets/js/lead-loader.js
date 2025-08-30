(function(){
  const form = document.getElementById('leadForm');
  const overlay = document.getElementById('leadLoadingOverlay');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  if(!form || !overlay) return;

  let active = 0;
  const origFetch = window.fetch;
  window.fetch = function(){
    active++;
    show();
    return origFetch.apply(this, arguments).finally(()=>{
      active = Math.max(0, active-1);
      if(active===0) hide();
      enable();
    });
  };

  function show(){
    overlay.classList.remove('hidden');
    document.body.style.pointerEvents = 'none';
  }
  function hide(){
    overlay.classList.add('hidden');
    document.body.style.pointerEvents = '';
  }
  function disable(){
    if(submitBtn && !submitBtn.disabled){
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = 'Submitting...';
    }
  }
  function enable(){
    if(submitBtn){
      submitBtn.disabled = false;
      if(submitBtn.dataset.originalText){
        submitBtn.innerHTML = submitBtn.dataset.originalText;
        delete submitBtn.dataset.originalText;
      }
    }
  }

  // Disable button & show overlay on submit (covers non-AJAX posts too)
  form.addEventListener('submit', function(){
    disable();
    show();
    // Safety net: if no fetch runs (e.g., plain form POST), auto-hide later
    setTimeout(()=>{ if(active===0) { enable(); hide(); } }, 15000);
  });

  // Return from bfcache, etc.
  window.addEventListener('pageshow', (e)=>{ if(e.persisted){ enable(); hide(); }});
  window.addEventListener('beforeunload', ()=>{ enable(); hide(); });
})();