
// Basic utilities
const CFG = {};
async function loadConfig(){
  const res = await fetch('config/config.json'); const json = await res.json();
  Object.assign(CFG, json);
  // Settings fallbacks
  if (CFG.home_news_count == null) CFG.home_news_count = 5;
}
async function loadCSV(url){
  const res = await fetch(url);
  const txt = await res.text();
  const lines = txt.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map(line => {
    // Simple CSV split (no quotes in our templates); upgrade if needed later
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h,i)=> obj[h]=cols[i]??"");
    return obj;
  });
}
async function getData(tab){
  const csvUrl = CFG.csv_urls?.[tab];
  if(csvUrl && csvUrl.length > 4){
    return await loadCSV(csvUrl);
  } else {
    return await loadCSV(`data/${tab}.csv`);
  }
}
function byId(id){ return document.getElementById(id); }
function setActiveNav(){
  const nav = byId('nav');
  if(!nav) return;
  nav.innerHTML = `
    <a href="index.html">Home</a>
    <a href="historiek.html">Historiek</a>
    <a href="kalender.html">Kalender</a>
    <a href="happening.html">International Football Happening</a>
    <a href="leden.html">Leden</a>
    <a href="contact.html">Contact/Info</a>
  `;
  const path = location.pathname.split('/').pop() || 'index.html';
  nav.querySelectorAll('a').forEach(a => { if(a.getAttribute('href')===path) a.classList.add('active'); });
}

// Sponsor track (left, sticky, non-clickable)
async function renderSponsors(){
  const box = byId('sponsor-track'); if(!box) return;
  const data = await getData('sponsors');
  const logos = data.filter(x=>true);
  function item(l){ return `<div class="sItem"><img src="${l.logo_url||''}" alt="${l.naam||'Sponsor'}" draggable="false"/></div>`; }
  box.innerHTML = logos.map(item).join('');
  // duplicate for seamless loop
  box.innerHTML += logos.map(item).join('');
}

// Home next/prev + news
function isFutureMatch(m){ return (m.uitslag||'').trim()===''; }
function formatDate(d){ try{ const a=d.split('-'); return `${a[2]}/${a[1]}/${a[0]}` }catch(e){ return d } }
function teamCell(name, icon){ return `<span style="display:inline-flex;align-items:center;gap:6px;"><img src="icons/${icon}.svg" width="18" height="18" alt=""/> ${name}</span>`; }

async function renderHome(){
  const n = byId('home-next'); const p = byId('home-prev'); const news = byId('home-news');
  if(!(n&&p&&news)) return;
  // font controls
  document.querySelectorAll('.fontBtn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const dir = btn.dataset.font;
      const html = document.documentElement;
      const cur = parseFloat(getComputedStyle(html).fontSize);
      html.style.fontSize = (dir==='+'? cur+1 : Math.max(12,cur-1)) + 'px';
    });
  });
  const kal = await getData('kalender');
  // Previous = last with uitslag filled; Next = first with uitslag empty
  let prev = null, next = null;
  for(const row of kal){ if(!isFutureMatch(row)) prev=row; else { next=row; break; } }
  n.innerHTML = next ? (`<div><strong>${formatDate(next.datum)} ${next.uur||''}</strong></div>
    <div>${teamCell(next.thuis,'home')} vs ${teamCell(next.uit,'bus')}</div>
    <div class="kicker">${next.locatie||''}</div>`) : '—';
  p.innerHTML = prev ? (`<div><strong>${formatDate(prev.datum)} ${prev.uur||''}</strong></div>
    <div>${teamCell(prev.thuis,'home')} vs ${teamCell(prev.uit,'bus')}</div>
    <div><span class="badge">Uitslag</span> ${prev.uitslag||'-'} ${prev.verslag_id? ` · <a href="verslag.html?id=${encodeURIComponent(prev.verslag_id)}" target="_blank" rel="noopener">📝 ${prev.verslag_titel||'Verslag'}</a>`:''}</div>`) : '—';
  // News (latest N from verslagen)
  const V = await getData('verslagen');
  const N = CFG.home_news_count || 5;
  const last = V.slice(-N).reverse();
  news.innerHTML = last.map(v=>`<div style="margin:8px 0;">
    <div class="kicker">${formatDate(v.datum)} — ${v.tegenstander||''}</div>
    <div><a href="verslag.html?id=${encodeURIComponent(v.id)}">${v.titel||'Verslag'}</a></div>
    <div>${v.samenvatting||''}</div>
  </div>`).join('');
}

// Kalender page
async function renderKalender(){
  const table = document.querySelector('#kalender-table tbody'); if(!table) return;
  const sel = byId('seasonSel');
  const kal = await getData('kalender');
  const seasons = [...new Set(kal.map(x=>x.seizoen))].filter(Boolean);
  sel.innerHTML = seasons.map(s=>`<option value="${s}">${s}</option>`).join('');
  const defS = CFG.kalender_default_seizoen || seasons[0];
  sel.value = defS;
  function rowHTML(m){
    const gray = (m.uitslag||'').trim()==='' ? ' style="color:#9aa3ad"' : '';
    const verslag = m.verslag_id ? `<a href="verslag.html?id=${encodeURIComponent(m.verslag_id)}" target="_blank" rel="noopener" title="${m.verslag_titel||'Verslag'}"><img src="icons/note.svg" width="18" height="18" alt="Verslag"/></a>` : '';
    return `<tr${gray}>
      <td>${formatDate(m.datum)}</td>
      <td>${m.uur||''}</td>
      <td>${teamCell(m.thuis,'home')}</td>
      <td>${teamCell(m.uit,'bus')}</td>
      <td>${m.locatie||''}</td>
      <td>${m.uitslag||''}</td>
      <td>${verslag}</td>
    </tr>`;
  }
  function refresh(){
    const s = sel.value;
    const subset = kal.filter(x=>x.seizoen===s);
    table.innerHTML = subset.map(rowHTML).join('') || '<tr><td colspan="7">Geen wedstrijden</td></tr>';
  }
  sel.addEventListener('change', refresh);
  refresh();
}

// Verslagen list
async function renderVerslagen(){
  const wrap = byId('verslag-list'); if(!wrap) return;
  const V = await getData('verslagen');
  wrap.innerHTML = V.map(v=>`
    <article class="card" style="margin-bottom:12px;">
      <div class="kicker">${formatDate(v.datum)} — ${v.tegenstander||''}</div>
      <h3 style="margin:6px 0;"><a href="verslag.html?id=${encodeURIComponent(v.id)}">${v.titel||'Verslag'}</a></h3>
      <p>${v.samenvatting||''}</p>
      ${v.fotos_url? `<p><a href="${v.fotos_url}" target="_blank" rel="noopener">Foto's</a></p>`:''}
    </article>
  `).join('');
}

// Verslag detail
async function renderVerslagDetail(){
  const box = byId('verslag-detail'); if(!box) return;
  const id = new URLSearchParams(location.search).get('id')||'';
  const V = await getData('verslagen');
  const v = V.find(x=> (x.id||'')===id);
  if(!v){ box.innerHTML = 'Verslag niet gevonden.'; return; }
  box.innerHTML = `
    <div class="kicker">${formatDate(v.datum)} — ${v.tegenstander||''}</div>
    <h3>${v.titel||'Verslag'}</h3>
    <p>${(v.inhoud||'').replace(/\\n/g,'<br/>')}</p>
    ${v.fotos_url? `<p><a href="${v.fotos_url}" target="_blank" rel="noopener">Foto's</a></p>`:''}
  `;
}

// Leden
function sortAZ(a,b){ return (a.naam||'').localeCompare(b.naam||''); }
async function renderLeden(){
  const grid = byId('leden-grid'); if(!grid) return;
  const L = (await getData('leden')).sort(sortAZ);
  const C = await getData('leden_config');
  const visGrid = C.filter(c=> (c.show_grid||'').toUpperCase()==='TRUE').sort((a,b)=> (parseInt(a.order_grid||'99') - parseInt(b.order_grid||'99')));
  function cardHTML(p){
    const img = p.foto_url? `<img src="${p.foto_url}" alt="${p.naam||'Lid'}" style="border-radius:12px;max-height:180px;object-fit:cover;width:100%;">` : '';
    let lines = visGrid.filter(c=>c.field!=='foto_url').map(c=> `<div><strong>${c.label||''}</strong> ${p[c.field]||''}</div>`).join('');
    return `<div class="card" data-id="${p.id||''}" style="margin-bottom:12px;cursor:pointer;">
      ${visGrid.find(c=>c.field==='foto_url')? img : ''}
      ${lines}
    </div>`;
  }
  grid.innerHTML = L.map(cardHTML).join('');
  // Modal behavior
  const modal = byId('leden-modal'); const modalBody = byId('modal-body'); const modalTitle = byId('modal-title');
  const close = byId('modal-close'); close.addEventListener('click', ()=> modal.classList.remove('open'));
  grid.querySelectorAll('.card').forEach(card=>{
    card.addEventListener('click', ()=>{
      const id = card.getAttribute('data-id');
      const p = L.find(x=> (x.id||'')===id);
      const visModal = C.filter(c=> (c.show_modal||'').toUpperCase()==='TRUE').sort((a,b)=> (parseInt(a.order_modal||'99') - parseInt(b.order_modal||'99')));
      modalTitle.textContent = p?.naam || 'Profiel';
      const img = (p?.foto_url)? `<img src="${p.foto_url}" alt="${p.naam||'Lid'}" style="border-radius:12px;max-height:300px;object-fit:cover;width:100%;margin-bottom:10px;">` : '';
      let rows = visModal.filter(c=>c.field!=='foto_url').map(c=> `<div style="margin:6px 0;"><strong>${c.label||''}</strong> ${p?.[c.field]||''}</div>`).join('');
      modalBody.innerHTML = img + rows;
      modal.classList.add('open');
    });
  });
}

// Contact, Happening contacteer
function setupContact(){
  const link = document.getElementById('mailtoLink');
  if(link && CFG.mailto_contact) link.href = CFG.mailto_contact;
  const btn = document.getElementById('contacteerBtn');
  if(btn && CFG.mailto_contact){ btn.href = CFG.mailto_contact; }
}

// Timeline simple click (placeholder)
function setupTimeline(){
  const tl = document.getElementById('timeline'); const out = document.getElementById('timeline-detail');
  if(!(tl&&out)) return;
  tl.querySelectorAll('div').forEach(div=>{
    div.style.cursor='pointer';
    div.addEventListener('click', ()=>{
      out.innerHTML = `<p><strong>${div.textContent}</strong></p><p>Hier komt de bijhorende tekst en foto('s).</p>`;
    });
  });
}

// Boot
document.addEventListener('DOMContentLoaded', async ()=>{
  setActiveNav();
  await loadConfig();
  renderSponsors();
  renderHome();
  renderKalender();
  renderVerslagen();
  renderVerslagDetail();
  renderLeden();
  setupContact();
  setupTimeline();
});
