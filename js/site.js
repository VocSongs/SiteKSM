// SPA-lite patch: vaste top-tegel + fades + doorlopende scroller

const CFG = {};
async function loadConfig(){
  const r = await fetch('config/config.json'); if(!r.ok) throw new Error('missing config');
  Object.assign(CFG, await r.json());
}

const routes=[
  {key:'home',label:'Home',file:'pages/home.html'},
  {key:'historiek',label:'Historiek',file:'pages/historiek.html'},
  {key:'kalender',label:'Kalender',file:'pages/kalender.html'},
  {key:'happening',label:'International Football Happening',file:'pages/happening.html'},
  {key:'leden',label:'Leden',file:'pages/leden.html'},
  {key:'contact',label:'Contact/Info',file:'pages/contact.html'}
];
function buildNav(){ const nav=document.getElementById('nav'); if(!nav) return; nav.innerHTML=routes.map(r=>`<a href="?page=${r.key}" data-route="${r.key}">${r.label}</a>`).join(''); }
function setActive(k){ const nav=document.getElementById('nav'); if(!nav) return; nav.querySelectorAll('a').forEach(a=>a.classList.toggle('active', a.dataset.route===k)); }

const drivePrimary=id=>`https://drive.google.com/uc?export=view&id=${id}`;
const driveFallback=id=>`https://lh3.googleusercontent.com/d/${id}=w2000`;

function setupSponsorTop(){
  const img=document.getElementById('sTopImg');
  const url=CFG.sponsor_bar?.top_fixed_image||"";
  const h=Number(CFG.sponsor_bar?.top_fixed_height||140);
  if(url && img){
    document.documentElement.style.setProperty('--top-h', h+'px');
    img.src=url;
  }else{
    document.documentElement.style.setProperty('--top-h','0px');
    if(img && img.parentElement) img.parentElement.style.display='none';
  }
}

async function getCSV(tab){
  const r=await fetch(`data/${tab}.csv`);
  const t=await r.text();
  const lines=t.trim().split(/\r?\n/); const head=lines.shift().split(',');
  return lines.filter(Boolean).map(L=>{const c=L.split(','); const o={}; head.forEach((h,i)=>o[h]=c[i]??""); return o;});
}

async function renderSponsorsOnce(){
  const box=document.getElementById('sponsor-track'); if(!box) return;
  if(box.dataset.ready==='1') return;
  let logos=[];
  try{
    const api=CFG.google_drive?.api_key?.trim();
    const fld=CFG.google_drive?.sponsor_folder_id?.trim();
    if(api && fld){
      const q=encodeURIComponent(`'${fld}' in parents and trashed=false and mimeType contains 'image/'`);
      const u=`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=200&key=${api}`;
      const r=await fetch(u); if(!r.ok) throw new Error('drive');
      const data=await r.json();
      const files=(data.files||[]).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
      logos = files.map(f=>({naam:f.name||'Sponsor', id:f.id, logo_url:drivePrimary(f.id)}));
    }
  }catch(e){ console.warn('Drive sponsors failed, fallback to CSV', e); }
  if(!logos.length){
    const data=await getCSV('sponsors');
    logos=data.map(x=>{ const m=(x.logo_url||'').match(/id=([\w-]+)/); const id=m?m[1]:null; return {naam:x.naam||'Sponsor', id, logo_url:x.logo_url||''}; });
  }
  const item=l=>{ const src=l.logo_url || (l.id?drivePrimary(l.id):''); const fb=l.id?driveFallback(l.id):(l.logo_url||''); return `<div class="sItem"><img src="${src}" alt="${l.naam||''}" draggable="false" onerror="this.onerror=null;this.src='${fb}'"/></div>`; };
  const html = logos.map(item).join('');
  box.innerHTML = html + html; // dubbele lijst = naadloos
  box.dataset.ready='1';
}

async function loadPage(key,push=true){
  const fade=document.getElementById('pageFade'); fade.classList.add('show');
  const r=routes.find(x=>x.key===key)||routes[0];
  const html=await (await fetch(r.file)).text();
  const content=document.getElementById('content'); content.innerHTML=html;
  setActive(r.key);
  if(push){ const u=new URL(location.href); u.searchParams.set('page',r.key); history.pushState({page:r.key},'',u.toString()); }
  setTimeout(()=>fade.classList.remove('show'),200);
}
function bootRouter(){
  buildNav();
  document.getElementById('nav').querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault(); loadPage(a.dataset.route);}));
  const k=new URLSearchParams(location.search).get('page')||'home';
  loadPage(k,false);
  window.onpopstate=ev=>{ const k2=ev.state?.page||new URLSearchParams(location.search).get('page')||'home'; loadPage(k2,false); };
}

document.addEventListener('DOMContentLoaded', async ()=>{
  buildNav();
  await loadConfig();
  setupSponsorTop();
  await renderSponsorsOnce();
  bootRouter();
});
