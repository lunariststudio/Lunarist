document.addEventListener('DOMContentLoaded',()=>{
document.querySelectorAll('.project-thumb img,[data-media-type="youtube"] img').forEach(img=>{
 const s=(img.currentSrc||img.src||'').toLowerCase();
 if(s.includes('ytimg.com')||s.includes('youtube')){
   img.closest('.project-thumb,.thumb')?.classList.add('youtube');
 }
});
});