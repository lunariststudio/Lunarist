(function(){'use strict';if(window.__lunaristOAuthAdminUI)return;window.__lunaristOAuthAdminUI=true;let booted=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));const toast=m=>{try{window.toast?.(m)}catch{}};
