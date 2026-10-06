
(()=> {
  const clouds=document.querySelector('.brand-clouds');
  if(!clouds || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let t=0, last=performance.now(), frameId=0;
  const parts=[...clouds.querySelectorAll('span')];
  function frame(now){
    const dt=Math.min(40,now-last); last=now; t+=dt*0.001;
    const x=Math.sin(t*0.42)*1.7 + Math.sin(t*0.19)*0.8;
    const y=Math.sin(t*0.55)*3.2;
    clouds.style.setProperty('transform','translate3d('+x+'%,'+y+'px,0)','important');
    parts.forEach((p,i)=>{
      const phase=i*0.9;
      const px=Math.sin(t*(0.55+i*.035)+phase)*5.5;
      const py=Math.sin(t*(0.7+i*.045)+phase)*5.5;
      const scale=0.985+Math.sin(t*(0.42+i*.025)+phase)*0.018;
      p.style.setProperty('transform','translate3d('+px+'px,'+py+'px,0) scale('+scale+')','important');
    });
    frameId=requestAnimationFrame(frame);
  }
  frameId=requestAnimationFrame(frame);
})();
