/* NOVALE · Apeltrys Analytical Map · app.js
 * Roda dentro do DealSourcing (/crm/apeltrys), num iframe da mesma origem.
 * Os dados NÃO ficam neste arquivo nem no GitHub: a página-mãe busca na API
 * protegida (admin e gestão) e entrega aqui por postMessage ("amap:init").
 * A malha de municípios (IBGE, pública) vem de geo/*.topo.json.
 */
(function(){
"use strict";
const ORIGIN = location.origin;
const toParent = (type,payload) => { try{ if(window.parent!==window) window.parent.postMessage({type,payload},ORIGIN); }catch(e){} };
const GEO = Promise.all(['geo/municipios.topo.json','geo/ufs.topo.json'].map(u=>fetch(u).then(r=>{ if(!r.ok) throw new Error(u); return r.json(); })));
let started=false, setFunnel=null;
window.addEventListener('message',ev=>{
  if(ev.origin!==ORIGIN || ev.source!==window.parent) return;
  const d=ev.data||{};
  if(d.type==='amap:init' && !started){ started=true;
    GEO.then(([m,u])=>{ start(d.payload,m,u); document.getElementById('boot').remove(); toParent('amap:started',{}); })
       .catch(e=>{ document.getElementById('boot').textContent='Não foi possível carregar o mapa. Recarregue a página.'; console.error(e); }); }
  else if(d.type==='amap:funnel' && setFunnel) setFunnel(d.payload||{});
  else if(d.type==='amap:saved'){ const el=document.getElementById('saveMsg'); if(el){ el.textContent=(d.payload&&d.payload.error)||'Salvo · vale para toda a gestão'; el.classList.toggle('err',!!(d.payload&&d.payload.error)); } }
});
toParent('amap:ready',{});
setTimeout(()=>{ const b=document.getElementById('boot'); if(!started&&b) b.querySelector('span').textContent='Abra pelo DealSourcing: menu Apeltrys Analytical Map (somente admin e gestão).'; },10000);

function start(INIT,TOPO_MUN,TOPO_UF){
const DATA=INIT.data;
const FUNNEL_STAGES=new Map((INIT.stages||[]).map(s=>[s.key,s.name]));
let FUN=INIT.funnel||{};
const fmt = n => n==null||n==='' ? '–' : Number(n).toLocaleString('pt-BR');
const fmt1 = n => Number(n).toLocaleString('pt-BR',{maximumFractionDigits:1});
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const keyNorm = s => String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
/** Chave do ISP: igual à da API (CNPJ ou nome+UF). */
const ispKey = s => { const c=String(s.cnpj||'').replace(/\D/g,''); return c.length===14 ? c : 'n:'+keyNorm(s.nome)+'|'+String(s.uf||'').toUpperCase(); };
const norm = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/['\-]/g,' ').replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const MONTHS = ['jan/26','fev/26','mar/26','abr/26','mai/26'];

// ---------- municipalities ----------
const MUN = new Map(); // ibge -> {id,n,uf,cep,nb[],c[lon,lat]}
for (const [k,v] of Object.entries(DATA.mun)) MUN.set(+k,{id:+k,n:v[0],uf:v[1],cep:v[2],nb:v[3],c:v[4]});
const NAMEKEY = new Map(); for (const m of MUN.values()) NAMEKEY.set(m.uf+'|'+norm(m.n), m.id);
const UFS = [...new Set([...MUN.values()].map(m=>m.uf))].sort();

// ---------- ISPs ----------
const ISPS = DATA.isps.map((r,i)=>({i,nome:r[0],rs:r[1],cnpj:r[2],max:r[3],m:r[4],tend:r[5],flag:r[6],porte:r[7],uf:r[8],cid:r[9],ibge:r[10],s1:r[11],s2:r[12],status:r[13],quem:r[14]}));
for (const s of ISPS) s.key=ispKey(s);
const ISP_BY_KEY = new Map(ISPS.map(s=>[s.key,s]));
const ISP_BY_MUN = new Map();
for (const s of ISPS) if (s.ibge){ if(!ISP_BY_MUN.has(s.ibge)) ISP_BY_MUN.set(s.ibge,[]); ISP_BY_MUN.get(s.ibge).push(s); }

// ---------- state / params ----------
const DEFAULTS = {t1:5000,t2:1000,cap:500000,skyMin:50000,skyRule:true,alaresMin:100,
  nb:{nio:true,sky:true,alares:true},on:{nio:true,sky:true,alares:true},custom:[],excl:(DATA.excl_padrao||[]).map(i=>ISPS[i]&&ISPS[i].key).filter(Boolean)};
let P = JSON.parse(JSON.stringify(DEFAULTS));
// parâmetros ficam no servidor (compartilhados pela gestão); exclusões guardadas pela chave do ISP
if (INIT.params && Object.keys(INIT.params).length) P=Object.assign(P,JSON.parse(JSON.stringify(INIT.params)));
let saveT=null;
const save=()=>{ clearTimeout(saveT); const el=document.getElementById('saveMsg'); if(el) el.textContent='Salvando…';
  saveT=setTimeout(()=>toParent('amap:params',JSON.parse(JSON.stringify(P))),700); };
let EXSET=new Set();
const ELIG=['T1','T2','T3'];
const stageName=k=>FUNNEL_STAGES.get(k)||k;

function buyersDef(){
  const B=[
    {id:'nio',name:'Nio',color:getCss('--nio'),core:new Set(DATA.nio),desc:`${DATA.nio.length} municípios onde a Nio está e compra`},
    {id:'sky',name:'Zaaz/Sky',color:getCss('--sky'),core:new Set(DATA.zaaz),desc:`${DATA.zaaz.length} municípios da rede Zaaz/Sky`},
    {id:'alares',name:'Alares',color:getCss('--alares'),core:new Set(Object.entries(DATA.alares).filter(([k,v])=>v>=P.alaresMin).map(([k])=>+k)),
      desc:`${Object.keys(DATA.alares).length} municípios na lista (Gaunzer), ${fmt(Object.values(DATA.alares).reduce((a,b)=>a+b,0))} assinantes`}
  ];
  P.custom.forEach((c,ix)=>B.push({id:'c'+ix,name:c.name,color:['#0b7285','#c2255c','#5c940d','#862e9c'][ix%4],core:new Set(c.ids),desc:`${c.ids.length} municípios (lista colada)`,custom:true,ix}));
  for (const b of B){
    if (P.on[b.id]===undefined) P.on[b.id]=true;
    if (P.nb[b.id]===undefined) P.nb[b.id]=true;
    b.on=P.on[b.id]; b.useNb=P.nb[b.id];
    const nb=new Set();
    for (const id of b.core){ const m=MUN.get(id); if(m) for(const n of m.nb) if(!b.core.has(n)) nb.add(n); }
    b.nbSet=nb;
  }
  return B;
}
function getCss(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}

let BUY=[], MSTAT=new Map(), RES=[];
function compute(){
  BUY=buyersDef();
  MSTAT=new Map(); EXSET=new Set(P.excl);
  for (const b of BUY){ if(!b.on) continue;
    for (const id of b.core){ if(!MSTAT.has(id)) MSTAT.set(id,{}); MSTAT.get(id)[b.id]='A'; }
    if (b.useNb) for (const id of b.nbSet){ if(!MSTAT.has(id)) MSTAT.set(id,{}); const o=MSTAT.get(id); if(!o[b.id]) o[b.id]='V'; }
  }
  for (const s of ISPS){
    const st = s.ibge ? (MSTAT.get(s.ibge)||{}) : {};
    const by = {};
    for (const b of BUY){ if(!b.on) continue; if (st[b.id]) by[b.id]=st[b.id]; }
    if (P.skyRule && P.on.sky && !by.sky && s.max>=P.skyMin) by.sky='S';
    s.by=by;
    const n=Object.keys(by).length;
    s.nBuy=n;
    s.capped = s.max>P.cap;
    s.excl = EXSET.has(s.key);
    s.fun = FUN[s.key] || (s.cnpj && FUN[s.cnpj]) || null;
    s.tier = s.excl ? 'TX' : (n===0||s.capped) ? 'T0' : s.max>=P.t1 ? 'T1' : s.max>=P.t2 ? 'T2' : 'T3';
  }
}
const TIERNAME={T1:'Tier 1',T2:'Tier 2',T3:'Tier 3',T0:'Sem comprador',TX:'Excluído'};
function tierHtml(s){ const t=s.tier; let lbl=TIERNAME[t]; if(t==='T0'&&s.capped&&s.nBuy) lbl='Acima do teto'; return `<span class="tier ${t}">${lbl}</span>`; }
function buyerBadges(by){
  return BUY.filter(b=>by[b.id]).map(b=>{const t=by[b.id];
    if(t==='A') return `<span class="badge b-A" style="background:${b.color}" title="${esc(b.name)} atua no município sede">${esc(b.name)}</span>`;
    if(t==='V') return `<span class="badge b-V" style="color:${b.color}" title="Sede em município vizinho à área de ${esc(b.name)}">${esc(b.name)} · viz.</span>`;
    return `<span class="badge b-S" title="Sky compra fora da área se ≥ ${fmt(P.skyMin)} assinantes (TBC)">Sky ≥${fmt(P.skyMin/1000)}k</span>`;
  }).join('');
}
const BYLBL={A:'Atua',V:'Vizinho',S:'Fora da área (≥ corte Sky)'};

// ---------- sidebar ----------
function renderBuyers(){
  const el=document.getElementById('buyers'); el.innerHTML='';
  for (const b of BUY){
    const d=document.createElement('div'); d.className='buyer';
    let extra='';
    if (b.id==='sky') extra=`<label class="chk"><input type="checkbox" data-k="skyRule" ${P.skyRule?'checked':''}> Fora da área, compra ISP com ≥ <span class="tbc">TBC</span></label>
      <div class="row"><label>assinantes</label><input type="number" data-k="skyMin" value="${P.skyMin}" step="5000" min="0"></div>`;
    if (b.id==='alares') extra=`<div class="row"><label>Considerar presença com ≥ assinantes Alares no município</label><input type="number" data-k="alaresMin" value="${P.alaresMin}" step="50" min="1"></div>
      <div class="mini muted">${b.core.size} de ${Object.keys(DATA.alares).length} municípios passam no corte.</div>`;
    if (b.custom) extra=`<button class="btn ghost mini" data-del="${b.ix}">Remover</button>`;
    d.innerHTML=`<div class="hd"><input type="checkbox" data-on="${b.id}" ${b.on?'checked':''}><span class="dot" style="background:${b.color}"></span>${esc(b.name)}</div>
      <div class="meta">${b.desc}</div>
      <label class="chk"><input type="checkbox" data-nb="${b.id}" ${b.useNb?'checked':''}> Incluir municípios vizinhos (+${b.nbSet.size})</label>${extra}`;
    el.appendChild(d);
  }
  el.querySelectorAll('[data-on]').forEach(i=>i.onchange=()=>{P.on[i.dataset.on]=i.checked;update();});
  el.querySelectorAll('[data-nb]').forEach(i=>i.onchange=()=>{P.nb[i.dataset.nb]=i.checked;update();});
  el.querySelectorAll('[data-k]').forEach(i=>i.onchange=()=>{P[i.dataset.k]= i.type==='checkbox'?i.checked:Math.max(0,+i.value||0);update();});
  el.querySelectorAll('[data-del]').forEach(i=>i.onclick=()=>{P.custom.splice(+i.dataset.del,1);update();});
}
document.getElementById('cbAdd').onclick=()=>{
  const name=document.getElementById('cbName').value.trim()||('Player '+(P.custom.length+1));
  const lines=document.getElementById('cbList').value.split(/\n/).map(s=>s.trim()).filter(Boolean);
  const ids=[],bad=[];
  for (const l of lines){ const p=l.split(/[;,\t]/); if(p.length<2){bad.push(l);continue;}
    let uf=p[0].trim().toUpperCase(), n=p.slice(1).join(' ').trim();
    if(uf.length!==2){ [uf,n]=[p[p.length-1].trim().toUpperCase(),p.slice(0,-1).join(' ').trim()]; }
    const id=NAMEKEY.get(uf+'|'+norm(n)); id?ids.push(id):bad.push(l); }
  const msg=document.getElementById('cbMsg');
  if(!ids.length){msg.textContent='Nenhum município reconhecido.';return;}
  P.custom.push({name,ids:[...new Set(ids)]});
  msg.textContent=`${ids.length} ok`+(bad.length?`, ${bad.length} não reconhecidos: ${bad.slice(0,3).join(' | ')}`:'');
  document.getElementById('cbList').value=''; document.getElementById('cbName').value='';
  update();
};
for (const k of ['t1','t2','cap']){ const i=document.getElementById(k); i.value=P[k]; i.onchange=()=>{P[k]=Math.max(0,+i.value||0);update();}; }
const fUF=document.getElementById('fUF'); UFS.forEach(u=>fUF.add(new Option(u,u))); fUF.onchange=()=>{update(); if(fUF.value) zoomToUF(fUF.value);};
document.getElementById('fFlag').onchange=update;
document.getElementById('reset').onclick=()=>{ if(!confirm('Restaurar os parâmetros padrão para toda a equipe de gestão?')) return; const c=P.custom;P=JSON.parse(JSON.stringify(DEFAULTS));P.custom=c;for(const k of ['t1','t2','cap'])document.getElementById(k).value=P[k];update();};

function passGlobal(s){ if(fUF.value && s.uf!==fUF.value) return false; if(document.getElementById('fFlag').checked && s.flag!==1) return false; return true; }

// ---------- KPIs ----------
function renderKpis(){
  const L=ISPS.filter(passGlobal);
  const t1=L.filter(s=>s.tier==='T1'), t2=L.filter(s=>s.tier==='T2'), t3=L.filter(s=>s.tier==='T3');
  const sum=a=>a.reduce((x,s)=>x+s.max,0);
  let munA=0,munV=0; for(const [id,o] of MSTAT){ if(fUF.value && MUN.get(id)?.uf!==fUF.value) continue; const v=Object.values(o); v.includes('A')?munA++:munV++; }
  const noSede=L.filter(s=>!s.ibge).length;
  document.getElementById('kpis').innerHTML=`
   <div class="kpi"><div class="l">ISPs Tier 1 (≥ ${fmt(P.t1)})</div><div class="v" style="color:var(--t1)">${fmt(t1.length)}</div><div class="s">${fmt(sum(t1))} assinantes</div></div>
   <div class="kpi"><div class="l">ISPs Tier 2 (${fmt(P.t2)}–${fmt(P.t1-1)})</div><div class="v" style="color:#b07c00">${fmt(t2.length)}</div><div class="s">${fmt(sum(t2))} assinantes</div></div>
   <div class="kpi"><div class="l">ISPs Tier 3 (com comprador, &lt; ${fmt(P.t2)})</div><div class="v">${fmt(t3.length)}</div><div class="s">${fmt(sum(t3))} assinantes</div></div>
   <div class="kpi"><div class="l">Municípios-alvo</div><div class="v">${fmt(munA+munV)}</div><div class="s">${fmt(munA)} onde atuam · ${fmt(munV)} vizinhos</div></div>
   <div class="kpi"><div class="l">ISPs na base Anatel${fUF.value?' ('+fUF.value+')':''}</div><div class="v">${fmt(L.length)}</div><div class="s">${fmt(noSede)} sem município sede</div></div>`;
}

// ---------- MAP ----------
const canvas=document.getElementById('map'), ctx=canvas.getContext('2d'), wrap=document.getElementById('mapwrap'), tip=document.getElementById('tip');
const munFeat=topojson.feature(TOPO_MUN,TOPO_MUN.objects[Object.keys(TOPO_MUN.objects)[0]]).features;
// corrige polígonos com orientação invertida (d3 os interpretaria como o globo inteiro)
for (const f of munFeat){ if (d3.geoArea(f)>2*Math.PI){ const g=f.geometry; const rv=p=>p.map(r=>r.slice().reverse());
  if(g.type==='Polygon') g.coordinates=rv(g.coordinates); else if(g.type==='MultiPolygon') g.coordinates=g.coordinates.map(rv); } }
const ufFeat=topojson.feature(TOPO_UF,TOPO_UF.objects[Object.keys(TOPO_UF.objects)[0]]).features;
const ufMesh=topojson.mesh(TOPO_UF,TOPO_UF.objects[Object.keys(TOPO_UF.objects)[0]]);
const brFC={type:'FeatureCollection',features:ufFeat};
let proj, W=0,H=0, dpr=1, T=d3.zoomIdentity, paths=[], ufPath=null, bounds=[];
function layout(){
  const r=wrap.getBoundingClientRect(); W=r.width; H=r.height; dpr=window.devicePixelRatio||1;
  canvas.width=W*dpr; canvas.height=H*dpr;
  proj=d3.geoMercator().fitExtent([[20,20],[W-20,H-20]],brFC);
  const gp=d3.geoPath(proj);
  paths=munFeat.map(f=>new Path2D(gp(f)||''));
  bounds=munFeat.map(f=>gp.bounds(f));
  ufPath=new Path2D(gp(ufMesh));
  draw();
}
function colorFor(id){
  const o=MSTAT.get(id); const mode=colorByEl.value;
  if(mode==='count'){ if(!o) return null; const n=Object.keys(o).length; const anyA=Object.values(o).includes('A');
    const pal=anyA?['#9ec5ee','#5b93d3','#2a5fa8','#163a6e']:['#e3eefb','#c7dcf4','#a9c7ec','#8bb2e2']; return pal[Math.min(n,4)-1]; }
  if(mode==='isp'){ const L=(ISP_BY_MUN.get(id)||[]).filter(s=>s.tier==='T1'||s.tier==='T2'); if(!L.length) return o?'#eef2f7':null;
    return L.some(s=>s.tier==='T1')?'#b2f2bb':'#ffec99'; }
  const b=BUY.find(x=>x.id===mode); if(!b||!o||!o[mode]) return null;
  return o[mode]==='A'? b.color : hexA(b.color,.32);
}
function hexA(h,a){const n=parseInt(h.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
let selMun=null, selIsp=null, dotList=[];
function draw(){
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(dpr*T.k,0,0,dpr*T.k,dpr*T.x,dpr*T.y);
  const showB=T.k>3.5;
  for(let i=0;i<munFeat.length;i++){
    const id=+munFeat[i].properties.i;
    if(fUF.value && MUN.get(id)?.uf!==fUF.value){ ctx.fillStyle='#f3f4f6'; ctx.fill(paths[i]); continue; }
    const c=colorFor(id); ctx.fillStyle=c||'#ffffff'; ctx.fill(paths[i]);
    if(showB){ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=.5/T.k;ctx.stroke(paths[i]);}
  }
  ctx.strokeStyle='#7d8590'; ctx.lineWidth=.9/T.k; ctx.stroke(ufPath);
  if(selMun!=null){ const i=munFeat.findIndex(f=>+f.properties.i===selMun); if(i>=0){ctx.strokeStyle='#111';ctx.lineWidth=2/T.k;ctx.stroke(paths[i]);}}
  // dots
  dotList=[];
  if(document.getElementById('showDots').checked){
    const w=document.getElementById('dotsWhich').value;
    const L=ISPS.filter(s=>s.ibge && passGlobal(s) && (w==='EVERY'||(w==='ALL'&&s.tier!=='T0')||(w==='T12'&&(s.tier==='T1'||s.tier==='T2'))||(w==='T1'&&s.tier==='T1'))).sort((a,b)=>b.max-a.max);
    const off=new Map();
    for(const s of L){ const m=MUN.get(s.ibge); if(!m||!m.c) continue; const p=proj(m.c);
      const k=off.get(s.ibge)||0; off.set(s.ibge,k+1);
      const zf=Math.min(1,Math.sqrt(T.k)/3); // pontos crescem um pouco com o zoom, em pixels de tela
      const ang=k*2.4, rr=k? (4+3*Math.sqrt(k))*zf/T.k:0;
      const x=p[0]+Math.cos(ang)*rr, y=p[1]+Math.sin(ang)*rr;
      const r=Math.max(2.5,Math.min(16,Math.sqrt(s.max)/12))*Math.max(.5,zf)/T.k;
      ctx.beginPath(); ctx.arc(x,y,r,0,7);
      ctx.fillStyle= s.tier==='T1'?'rgba(43,138,62,.85)': s.tier==='T2'?'rgba(232,162,0,.85)': s.tier==='T3'?'rgba(134,142,150,.75)':'rgba(73,80,87,.35)';
      ctx.fill(); ctx.lineWidth=(s===selIsp?2.2:.7)/T.k; ctx.strokeStyle=s===selIsp?'#000':'#fff'; ctx.stroke();
      dotList.push({s,x,y,r});
    }
  }
}
const colorByEl=document.getElementById('colorBy');
function renderColorBy(){ const v=colorByEl.value||'count'; colorByEl.innerHTML='';
  colorByEl.add(new Option('Nº de compradores interessados','count'));
  BUY.filter(b=>b.on).forEach(b=>colorByEl.add(new Option('Área: '+b.name,b.id)));
  colorByEl.add(new Option('Municípios com ISP Tier 1/2','isp'));
  colorByEl.value=[...colorByEl.options].some(o=>o.value===v)?v:'count'; }
colorByEl.onchange=()=>{draw();renderLegend();};
document.getElementById('showDots').onchange=()=>{draw();renderLegend();};
document.getElementById('dotsWhich').onchange=()=>{draw();};
function renderLegend(){
  const mode=colorByEl.value; let h='';
  if(mode==='count'){ h+='<b>Municípios</b><div class="mini muted">escuro = algum comprador atua · claro = só vizinho</div>';
    ['1','2','3','4+'].forEach((n,i)=>h+=`<div class="it"><span class="sw" style="background:${['#9ec5ee','#5b93d3','#2a5fa8','#163a6e'][i]}"></span><span class="sw" style="background:${['#e3eefb','#c7dcf4','#a9c7ec','#8bb2e2'][i]}"></span>${n} comprador(es)</div>`); }
  else if(mode==='isp'){ h+='<b>Municípios</b><div class="it"><span class="sw" style="background:#b2f2bb"></span>Sede de ISP Tier 1</div><div class="it"><span class="sw" style="background:#ffec99"></span>Sede de ISP Tier 2</div><div class="it"><span class="sw" style="background:#eef2f7"></span>Alvo sem ISP Tier 1/2 sediado</div>'; }
  else { const b=BUY.find(x=>x.id===mode); h+=`<b>${esc(b.name)}</b><div class="it"><span class="sw" style="background:${b.color}"></span>Atua</div><div class="it"><span class="sw" style="background:${hexA(b.color,.32)}"></span>Vizinho</div>`; }
  if(document.getElementById('showDots').checked) h+=`<div style="margin-top:6px"><b>Sede do ISP</b> (tamanho = assinantes)</div><div class="it"><span class="dot" style="background:var(--t1)"></span>Tier 1 <span class="dot" style="background:var(--t2);margin-left:6px"></span>Tier 2 <span class="dot" style="background:#868e96;margin-left:6px"></span>Tier 3</div>`;
  document.getElementById('legend').innerHTML=h;
}
const zoom=d3.zoom().scaleExtent([1,120]).on('zoom',e=>{T=e.transform;draw();});
d3.select(canvas).call(zoom).on('dblclick.zoom',null);
document.getElementById('zin').onclick=()=>d3.select(canvas).transition().duration(250).call(zoom.scaleBy,2);
document.getElementById('zout').onclick=()=>d3.select(canvas).transition().duration(250).call(zoom.scaleBy,.5);
document.getElementById('zreset').onclick=()=>d3.select(canvas).transition().duration(400).call(zoom.transform,d3.zoomIdentity);
function zoomToBounds(b,maxK=40){ const [[x0,y0],[x1,y1]]=b; const k=Math.min(maxK,.85/Math.max((x1-x0)/W,(y1-y0)/H));
  d3.select(canvas).transition().duration(600).call(zoom.transform,d3.zoomIdentity.translate(W/2,H/2).scale(k).translate(-(x0+x1)/2,-(y0+y1)/2)); }
function zoomToUF(uf){ const gp=d3.geoPath(proj); const fs=munFeat.filter(f=>MUN.get(+f.properties.i)?.uf===uf); if(!fs.length)return; zoomToBounds(gp.bounds({type:'FeatureCollection',features:fs})); }
function zoomToMun(id){ const i=munFeat.findIndex(f=>+f.properties.i===id); const m=MUN.get(id);
  const ids=[id,...(m?m.nb:[])]; const fs=munFeat.filter(f=>ids.includes(+f.properties.i));
  if(fs.length) zoomToBounds(d3.geoPath(proj).bounds({type:'FeatureCollection',features:fs}),60); }
function hit(ev){
  const r=canvas.getBoundingClientRect(); const sx=ev.clientX-r.left, sy=ev.clientY-r.top;
  const [px,py]=T.invert([sx,sy]);
  for(let j=dotList.length-1;j>=0;j--){const d=dotList[j]; if((px-d.x)**2+(py-d.y)**2<= (d.r+1/T.k)**2) return {isp:d.s,sx,sy};}
  for(let i=0;i<munFeat.length;i++){ const b=bounds[i]; if(px<b[0][0]||px>b[1][0]||py<b[0][1]||py>b[1][1]) continue;
    if(d3.geoContains(munFeat[i],proj.invert([px,py]))) return {mun:+munFeat[i].properties.i,sx,sy}; }
  return {sx,sy};
}
let moveRAF=null;
canvas.addEventListener('mousemove',ev=>{ if(moveRAF) return; moveRAF=requestAnimationFrame(()=>{moveRAF=null; const h=hit(ev);
  if(h.isp){ tip.innerHTML=`<b>${esc(h.isp.nome)}</b> · ${fmt(h.isp.max)} assin. · ${TIERNAME[h.isp.tier]}`; }
  else if(h.mun){ const m=MUN.get(h.mun); const o=MSTAT.get(h.mun)||{}; const n=(ISP_BY_MUN.get(h.mun)||[]).length;
    tip.innerHTML=`<b>${esc(m?m.n:h.mun)} – ${m?m.uf:''}</b>${Object.keys(o).length?' · '+BUY.filter(b=>o[b.id]).map(b=>b.name+(o[b.id]==='V'?' (viz.)':'')).join(', '):''} · ${n} ISP(s) sediado(s)`; }
  else { tip.style.display='none'; return; }
  tip.style.display='block'; tip.style.left=(h.sx+14)+'px'; tip.style.top=(h.sy+10)+'px'; });});
canvas.addEventListener('mouseleave',()=>tip.style.display='none');
let downAt=null; canvas.addEventListener('mousedown',e=>downAt=[e.clientX,e.clientY]);
canvas.addEventListener('click',ev=>{ if(downAt&&Math.hypot(ev.clientX-downAt[0],ev.clientY-downAt[1])>4) return;
  const h=hit(ev); if(h.isp) showIsp(h.isp,'detail'); else if(h.mun) showMun(h.mun); });
const munList=document.getElementById('munList');
munList.innerHTML=[...MUN.values()].map(m=>`<option value="${esc(m.n)} - ${m.uf}">`).join('');
document.getElementById('munSearch').onchange=e=>{ const v=e.target.value; const mm=v.match(/^(.*) - ([A-Z]{2})$/); if(!mm) return;
  const id=NAMEKEY.get(mm[2]+'|'+norm(mm[1])); if(id){ showMun(id); zoomToMun(id);} };

// ---------- detail panels ----------
function showMun(id){
  selMun=id; selIsp=null; draw();
  const m=MUN.get(id); const o=MSTAT.get(id)||{};
  const L=(ISP_BY_MUN.get(id)||[]).slice().sort((a,b)=>b.max-a.max);
  const al=DATA.alares[id];
  let h=`<h2>${esc(m.n)} – ${m.uf}</h2><div class="muted mini">IBGE ${m.id} · Código (1º CEP) ${m.cep}</div>`;
  h+=`<div class="sec"><h4>Compradores</h4>`;
  const rows=BUY.map(b=>{ const inCore=b.core.has(id), inNb=b.nbSet.has(id);
    const st=inCore?'Atua':inNb?'Vizinho':'—'; const viaNb = inNb? [...m.nb].filter(n=>b.core.has(n)).map(n=>MUN.get(n)?.n).filter(Boolean):[];
    return `<div class="row" style="align-items:flex-start"><span class="dot" style="background:${b.color};margin-top:4px"></span><div style="flex:1"><b>${esc(b.name)}</b>: ${st}${!b.on?' <span class="muted">(desligado)</span>':''}${inNb&&!b.useNb&&b.on?' <span class="muted">(vizinhos desligados)</span>':''}
      ${b.id==='alares'&&al!=null?`<div class="mini muted">${fmt(al)} assinantes Alares no município${al<P.alaresMin?' (abaixo do corte de presença)':''}</div>`:''}
      ${viaNb.length?`<div class="mini muted">Faz divisa com: ${esc(viaNb.slice(0,8).join(', '))}${viaNb.length>8?'…':''}</div>`:''}</div></div>`; }).join('');
  h+=rows+`</div>`;
  h+=`<div class="sec"><h4>ISPs sediados aqui (${L.length})</h4>`;
  h+= L.length? `<table><tbody>${L.map(s=>`<tr data-isp="${s.i}"><td>${esc(s.nome)}<div>${buyerBadges(s.by)}</div></td><td class="n">${fmt(s.max)}</td><td>${tierHtml(s)}</td></tr>`).join('')}</tbody></table>` : '<div class="muted">Nenhum ISP da base tem sede neste município.</div>';
  h+=`</div><div class="sec"><h4>Municípios vizinhos (${m.nb.length})</h4><div class="mini">${m.nb.map(n=>{const x=MUN.get(n);const c=(ISP_BY_MUN.get(n)||[]).length;return x?`<a href="#" data-mun="${n}">${esc(x.n)}${x.uf!==m.uf?' ('+x.uf+')':''}</a>${c?` <span class="muted">(${c})</span>`:''}`:n}).join(', ')}</div><div class="mini muted">(n) = ISPs sediados</div></div>`;
  const d=document.getElementById('detail'); d.innerHTML=h; bindDetail(d,'detail');
  emit('apeltrys:municipio',munInfo(id));
}
function bindDetail(d,target){
  d.querySelectorAll('[data-isp]').forEach(tr=>tr.onclick=()=>showIsp(ISPS[+tr.dataset.isp],target));
  d.querySelectorAll('[data-excl]').forEach(bt=>bt.onclick=()=>{const s=ISPS[+bt.dataset.excl]; P.excl=P.excl.includes(s.key)?P.excl.filter(x=>x!==s.key):[...P.excl,s.key]; update(); showIsp(s,target);});
  d.querySelectorAll('[data-send]').forEach(bt=>bt.onclick=()=>sendIsps([ISPS[+bt.dataset.send]],'one'));
  d.querySelectorAll('[data-open]').forEach(bt=>bt.onclick=()=>toParent('amap:open',{opportunity_id:bt.dataset.open}));
  d.querySelectorAll('[data-mun]').forEach(a=>a.onclick=e=>{e.preventDefault(); const id=+a.dataset.mun; goTab('mapa'); showMun(id); zoomToMun(id);});
}
function spark(m){ const w=300,h=50,mx=Math.max(...m),mn=Math.min(...m); const sc=i=>22+i*(w-44)/(m.length-1), sy=v=>mx===mn?h/2:h-8-(v-mn)/(mx-mn)*(h-16);
  return `<svg class="spark" width="${w}" height="${h+14}"><polyline fill="none" stroke="#0f2b5b" stroke-width="2" points="${m.map((v,i)=>sc(i)+','+sy(v)).join(' ')}"/>${m.map((v,i)=>`<circle cx="${sc(i)}" cy="${sy(v)}" r="3" fill="#0f2b5b"><title>${MONTHS[i]}: ${fmt(v)}</title></circle><text x="${sc(i)}" y="${h+12}" font-size="10" text-anchor="middle" fill="#6b7280">${MONTHS[i]}</text>`).join('')}</svg>`; }
function socio(s,lbl){ if(!s||!s[0]) return ''; const tel=[s[1],s[2]].filter(Boolean).join(' ');
  return `<div class="kv" style="margin-bottom:6px"><div>${lbl}</div><div><b>${esc(s[0])}</b></div>${tel?`<div>Celular</div><div>(${esc(s[1])}) ${esc(s[2])}</div>`:''}${s[3]?`<div>E-mail</div><div><a href="mailto:${esc(s[3].toLowerCase())}">${esc(s[3].toLowerCase())}</a></div>`:''}</div>`; }
function showIsp(s,target){
  selIsp=s; if(s.ibge) selMun=s.ibge; if(target==='detail') draw();
  const m=s.ibge?MUN.get(s.ibge):null;
  let h=`<h2>${esc(s.nome)}</h2><div class="muted">${esc(s.rs||'')}</div><div style="margin:6px 0">${tierHtml(s)} ${buyerBadges(s.by)}</div>`;
  h+=`<div class="sec"><div class="kv">
    <div>CNPJ</div><div>${esc(s.cnpj)||'–'}</div>
    <div>Sede</div><div>${m?`<a href="#" data-mun="${m.id}">${esc(m.n)} – ${m.uf}</a>`:(s.cid?esc(s.cid+' – '+s.uf):'<span class="muted">sem município sede na base</span>')}</div>
    <div>Porte</div><div>${esc(s.porte)||'–'}</div>
    <div>Assinantes (máx.)</div><div><b>${fmt(s.max)}</b></div>
    <div>Tendência</div><div>${s.tend>0?'+':''}${fmt1(s.tend)} assin./mês</div>
    <div>Flag col. O</div><div>${s.flag}</div>
    ${s.status?`<div>Status</div><div>${esc(s.status)}</div>`:''}${s.quem?`<div>Quem</div><div>${esc(s.quem)}</div>`:''}
  </div>${spark(s.m)}</div>`;
  h+=`<div class="sec"><h4>Por que é alvo</h4>${s.nBuy? BUY.filter(b=>s.by[b.id]).map(b=>`<div>• <b>${esc(b.name)}</b>: ${BYLBL[s.by[b.id]]}${s.by[b.id]==='S'?` (${fmt(s.max)} ≥ ${fmt(P.skyMin)})`:''}</div>`).join(''):'<div class="muted">Sem comprador pelos parâmetros atuais.</div>'}${s.capped?`<div class="muted">Acima do teto de ${fmt(P.cap)} assinantes (operadora/consolidador).</div>`:''}</div>`;
  h+=`<div class="sec funbox"><h4>Funil comercial</h4>${s.fun
    ? `<div class="fun in">No funil · ${esc(stageName(s.fun.stage_key))}</div><button class="btn ghost" data-open="${esc(s.fun.opportunity_id)}" style="margin-top:6px">Abrir no funil</button>`
    : s.excl ? '<div class="muted">Excluído da análise: reinclua para enviar.</div>'
    : `<div class="mini muted" style="margin-bottom:6px">Entra na etapa 1 (ISP identificado), na fila, sem responsável.</div><button class="btn" data-send="${s.i}">Enviar para o funil</button>`}</div>`;
  h+=`<div class="sec"><button class="btn ghost" data-excl="${s.i}">${s.excl?'Reincluir na análise':'Excluir da análise (comprador/não é alvo)'}</button></div>`;
  h+=`<div class="sec"><h4>Contatos</h4>${socio(s.s1,'Sócio 1')}${socio(s.s2,'Sócio 2')||''}${!s.s1[0]&&!s.s2[0]?'<div class="muted">Sem contatos na base.</div>':''}</div>`;
  const d=document.getElementById(target); d.innerHTML=h; bindDetail(d,target);
  emit('apeltrys:isp',matriz([s])[0]);
}

// ---------- ISP table ----------
const ISPCOLS=[
  {k:'nome',l:'ISP',f:s=>`<b>${esc(s.nome)}</b><div class="mini muted">${esc(s.rs)}${s.cnpj?' · '+esc(s.cnpj):''}</div>`},
  {k:'uf',l:'UF',f:s=>esc(s.uf)},
  {k:'cid',l:'Sede',f:s=>s.ibge?esc(MUN.get(s.ibge).n):'<span class="muted">–</span>'},
  {k:'porte',l:'Porte',f:s=>esc(s.porte)},
  {k:'max',l:'Assinantes',n:1,f:s=>fmt(s.max)},
  {k:'tend',l:'Tend./mês',n:1,f:s=>(s.tend>0?'+':'')+fmt1(s.tend)},
  {k:'nBuy',l:'Compradores',f:s=>buyerBadges(s.by)||'<span class="muted">–</span>'},
  {k:'tier',l:'Tier',f:s=>tierHtml(s)},
  {k:'s1',l:'Sócio 1',f:s=>s.s1[0]?esc(s.s1[0])+(s.s1[2]?`<div class="mini muted">(${esc(s.s1[1])}) ${esc(s.s1[2])}</div>`:''):''},
  {k:'fun',l:'Funil',f:s=>s.fun?`<span class="fun in" title="${esc(stageName(s.fun.stage_key))}">No funil</span><div class="mini muted">${esc(stageName(s.fun.stage_key))}</div>`
    : s.excl ? '<span class="muted">–</span>' : `<button class="btn mini" data-send="${s.i}">Enviar</button>`},
];
let ispSort={k:'max',d:-1}, ispPage=0; const PG=100;
const tierOrd={T1:1,T2:2,T3:3,T0:4,TX:5};
function ispFiltered(){
  const q=norm(document.getElementById('qIsp').value), ft=document.getElementById('fTier').value, fb=document.getElementById('fBuyer').value, fs=document.getElementById('fSede').value, ff=document.getElementById('fFunil').value;
  let L=ISPS.filter(s=>passGlobal(s)
    && (!ft || (ft==='T12'? (s.tier==='T1'||s.tier==='T2') : s.tier===ft))
    && (!fb || s.by[fb])
    && (!fs || (fs==='1'?!!s.ibge:!s.ibge))
    && (!ff || (ff==='in'?!!s.fun:!s.fun))
    && (!q || norm([s.nome,s.rs,s.cnpj,s.cid,s.uf,s.s1[0],s.s2[0]].join(' ')).includes(q)));
  const k=ispSort.k,d=ispSort.d;
  L.sort((a,b)=>{ let x=a[k],y=b[k]; if(k==='tier'){x=tierOrd[x];y=tierOrd[y];} if(k==='s1'){x=a.s1[0];y=b.s1[0];} if(k==='fun'){x=a.fun?1:0;y=b.fun?1:0;}
    if(typeof x==='string'||typeof y==='string') return d*String(x||'').localeCompare(String(y||''),'pt'); return d*((x||0)-(y||0)) || b.max-a.max; });
  return L;
}
function renderIspTable(){
  const L=ispFiltered(); const pages=Math.max(1,Math.ceil(L.length/PG)); ispPage=Math.min(ispPage,pages-1);
  const t=document.getElementById('tIsp');
  t.tHead.innerHTML='<tr>'+ISPCOLS.map(c=>`<th class="${c.n?'n':''}" data-k="${c.k}">${c.l}${ispSort.k===c.k?(ispSort.d>0?' ▲':' ▼'):''}</th>`).join('')+'</tr>';
  t.tBodies[0].innerHTML=L.slice(ispPage*PG,(ispPage+1)*PG).map(s=>`<tr data-isp="${s.i}">${ISPCOLS.map(c=>`<td class="${c.n?'n':''}">${c.f(s)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="10" class="empty">Nenhum ISP com esses filtros.</td></tr>';
  t.tHead.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k; ispSort= ispSort.k===k?{k,d:-ispSort.d}:{k,d:(k==='max'||k==='tend'||k==='nBuy')?-1:1}; renderIspTable();});
  t.tBodies[0].querySelectorAll('tr[data-isp]').forEach(tr=>tr.onclick=()=>showIsp(ISPS[+tr.dataset.isp],'detail2'));
  t.tBodies[0].querySelectorAll('[data-send]').forEach(bt=>bt.onclick=e=>{e.stopPropagation(); sendIsps([ISPS[+bt.dataset.send]],'one');});
  const elig=L.filter(s=>!s.fun && ELIG.includes(s.tier)); const sb=document.getElementById('sendBulk');
  sb.disabled=!elig.length; sb.textContent=elig.length?`Enviar ${fmt(elig.length)} ao funil`:'Nada a enviar';
  sb.title='Envia os ISPs filtrados (Tier 1, 2 e 3) que ainda não estão no funil';
  document.getElementById('ispCount').textContent=`${fmt(L.length)} ISPs · ${fmt(L.reduce((a,s)=>a+s.max,0))} assinantes`;
  document.getElementById('pInfo').textContent=`Página ${ispPage+1} de ${pages}`;
}
document.getElementById('sendBulk').onclick=()=>{ const L=ispFiltered().filter(s=>!s.fun && ELIG.includes(s.tier)); if(L.length) sendIsps(L,'bulk'); };
['qIsp','fTier','fBuyer','fSede','fFunil'].forEach(id=>document.getElementById(id).addEventListener(id==='qIsp'?'input':'change',()=>{ispPage=0;renderIspTable();}));
document.getElementById('pPrev').onclick=()=>{ispPage=Math.max(0,ispPage-1);renderIspTable();};
document.getElementById('pNext').onclick=()=>{ispPage++;renderIspTable();};
function renderBuyerFilter(){ const sel=document.getElementById('fBuyer'), v=sel.value; sel.innerHTML='<option value="">Qualquer comprador</option>'; BUY.filter(b=>b.on).forEach(b=>sel.add(new Option(b.name,b.id))); sel.value=[...sel.options].some(o=>o.value===v)?v:'';
  const s2=document.getElementById('fMunBuyer'), v2=s2.value; s2.innerHTML='<option value="">Com interesse de algum comprador</option><option value="*">Todos os municípios</option>'; BUY.filter(b=>b.on).forEach(b=>s2.add(new Option('Área: '+b.name,b.id))); s2.value=[...s2.options].some(o=>o.value===v2)?v2:''; }

// ---------- municipality table ----------
let munSort={k:'t12',d:-1}, munPage=0;
function munRows(){
  const q=norm(document.getElementById('qMun').value), fb=document.getElementById('fMunBuyer').value, ft=document.getElementById('fMunTipo').value;
  const out=[];
  for(const m of MUN.values()){
    if(fUF.value && m.uf!==fUF.value) continue;
    const o=MSTAT.get(m.id)||{};
    if(fb==='' && !Object.keys(o).length) continue;
    if(fb && fb!=='*' && !o[fb]) continue;
    if(ft){ const vals= fb&&fb!=='*'? [o[fb]] : Object.values(o); if(ft==='A'&&!vals.includes('A')) continue; if(ft==='V'&&vals.includes('A')) continue; }
    if(q && !norm(m.n).includes(q)) continue;
    const L=ISP_BY_MUN.get(m.id)||[];
    out.push({m,o,nb:Object.keys(o).length,isp:L.length,subs:L.reduce((a,s)=>a+s.max,0),t1:L.filter(s=>s.tier==='T1').length,t12:L.filter(s=>s.tier==='T1'||s.tier==='T2').length,al:DATA.alares[m.id]??null,n:m.n,uf:m.uf});
  }
  const k=munSort.k,d=munSort.d;
  out.sort((a,b)=>{const x=a[k],y=b[k]; if(typeof x==='string') return d*x.localeCompare(y,'pt'); return d*((x??-1)-(y??-1)) || b.subs-a.subs;});
  return out;
}
function renderMunTable(){
  const R=munRows(); const pages=Math.max(1,Math.ceil(R.length/PG)); munPage=Math.min(munPage,pages-1);
  const cols=[{k:'n',l:'Município'},{k:'uf',l:'UF'},...BUY.filter(b=>b.on).map(b=>({k:'b_'+b.id,l:b.name,b})),{k:'al',l:'Assin. Alares',n:1},{k:'nb',l:'Nº compradores',n:1},{k:'isp',l:'ISPs sediados',n:1},{k:'subs',l:'Assin. ISPs sediados',n:1},{k:'t1',l:'Tier 1',n:1},{k:'t12',l:'Tier 1+2',n:1}];
  const t=document.getElementById('tMun');
  t.tHead.innerHTML='<tr>'+cols.map(c=>`<th class="${c.n?'n':''}" data-k="${c.k}">${c.l}${munSort.k===c.k?(munSort.d>0?' ▲':' ▼'):''}</th>`).join('')+'</tr>';
  t.tBodies[0].innerHTML=R.slice(munPage*PG,(munPage+1)*PG).map(r=>`<tr data-mun="${r.m.id}">${cols.map(c=>{
    if(c.b){const v=r.o[c.b.id]; return `<td>${v==='A'?`<span class="badge b-A" style="background:${c.b.color}">Atua</span>`:v==='V'?`<span class="badge b-V" style="color:${c.b.color}">Vizinho</span>`:''}</td>`;}
    if(c.k==='n') return `<td><b>${esc(r.n)}</b><div class="mini muted">IBGE ${r.m.id} · CEP ${r.m.cep}</div></td>`;
    if(c.k==='uf') return `<td>${r.uf}</td>`;
    return `<td class="n">${r[c.k]==null?'':fmt(r[c.k])}</td>`; }).join('')}</tr>`).join('')||'<tr><td class="empty" colspan="12">Nenhum município.</td></tr>';
  t.tHead.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k; if(k.startsWith('b_'))return; munSort= munSort.k===k?{k,d:-munSort.d}:{k,d:(k==='n'||k==='uf')?1:-1}; renderMunTable();});
  t.tBodies[0].querySelectorAll('tr[data-mun]').forEach(tr=>tr.onclick=()=>{const id=+tr.dataset.mun; goTab('mapa'); showMun(id); zoomToMun(id);});
  document.getElementById('munCount').textContent=`${fmt(R.length)} municípios`;
  document.getElementById('mInfo').textContent=`Página ${munPage+1} de ${pages}`;
}
['qMun','fMunBuyer','fMunTipo'].forEach(id=>document.getElementById(id).addEventListener(id==='qMun'?'input':'change',()=>{munPage=0;renderMunTable();}));
document.getElementById('mPrev').onclick=()=>{munPage=Math.max(0,munPage-1);renderMunTable();};
document.getElementById('mNext').onclick=()=>{munPage++;renderMunTable();};

// ---------- tabs ----------
function goTab(v){ document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.v===v)); document.querySelectorAll('.view').forEach(s=>s.classList.toggle('on',s.id==='v-'+v)); if(v==='mapa') requestAnimationFrame(layout); }
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>goTab(t.dataset.v));

// ---------- export ----------
function dl(name,text,type){ const b=new Blob([text],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); }
const csvCell=v=>{v=v==null?'':(typeof v==='number'&&!Number.isInteger(v))?String(v).replace('.',','):Array.isArray(v)?v.join(' '):String(v); return /[";\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
function matriz(list){
  return list.map(s=>{ const m=s.ibge?MUN.get(s.ibge):null; const o={
    tier:TIERNAME[s.tier], isp:s.nome, razao_social:s.rs, cnpj:s.cnpj, porte:s.porte, uf_sede:s.uf, cidade_sede:m?m.n:s.cid, ibge_sede:s.ibge||'', cep_cod_sede:m?m.cep:'',
    assinantes_max:s.max, jan26:s.m[0],fev26:s.m[1],mar26:s.m[2],abr26:s.m[3],mai26:s.m[4], tendencia_mes:s.tend, flag_col_O:s.flag, acima_teto:s.capped?'sim':'nao', excluido:s.excl?'sim':'nao', n_compradores:s.nBuy };
    for(const b of BUY) if(b.on) o['comprador_'+b.name]= s.by[b.id]?BYLBL[s.by[b.id]]:'';
    o.no_funil = s.fun ? stageName(s.fun.stage_key) : '';
    Object.assign(o,{socio1_nome:s.s1[0],socio1_ddd:s.s1[1],socio1_cel:s.s1[2],socio1_email:s.s1[3],socio2_nome:s.s2[0],socio2_ddd:s.s2[1],socio2_cel:s.s2[2],socio2_email:s.s2[3],status:s.status,quem:s.quem});
    return o; });
}
function toCsv(rows){ if(!rows.length) return ''; const h=Object.keys(rows[0]); return '﻿'+h.join(';')+'\n'+rows.map(r=>h.map(k=>csvCell(r[k])).join(';')).join('\n'); }
document.getElementById('exp-isp').onclick=()=>dl('apeltrys_matriz_isps.csv',toCsv(matriz(ispFiltered())),'text/csv;charset=utf-8');
function munExport(){ return munRows().map(r=>{const o={municipio:r.n,uf:r.uf,ibge:r.m.id,cep_cod:r.m.cep}; for(const b of BUY) if(b.on) o['area_'+b.name]=r.o[b.id]==='A'?'Atua':r.o[b.id]==='V'?'Vizinho':''; Object.assign(o,{assin_alares:r.al??'',n_compradores:r.nb,isps_sediados:r.isp,assin_isps_sediados:r.subs,tier1:r.t1,tier1_2:r.t12,vizinhos_ibge:r.m.nb.join(' ')}); return o;}); }
document.getElementById('exp-mun').onclick=()=>dl('apeltrys_municipios.csv',toCsv(munExport()),'text/csv;charset=utf-8');
document.getElementById('exp-json').onclick=()=>dl('apeltrys_targets.json',JSON.stringify({gerado_em:new Date().toISOString(),parametros:P,isps:matriz(ispFiltered()),municipios:munExport()},null,1),'application/json');
// ---------- API de integração ----------
const VERSION='1.1.0';
function emit(type,payload){
  try{ window.dispatchEvent(new CustomEvent(type,{detail:payload})); }catch(e){}
}
/** Pede à página-mãe para enviar ISPs ao funil (ela confirma e chama a API). */
function sendIsps(list,mode){
  const items=list.slice(0,3000).map(s=>({amap_key:s.key, tier:TIERNAME[s.tier], n_buyers:s.nBuy,
    buyers:Object.fromEntries(BUY.filter(b=>s.by[b.id]).map(b=>[b.name,BYLBL[s.by[b.id]]])), name:s.nome, uf:s.uf, subscribers:s.max}));
  const by={}; for(const it of items) by[it.tier]=(by[it.tier]||0)+1;
  toParent('amap:send',{mode,items,by_tier:by,total:list.length});
}
function kpiResumo(){ const L=ISPS.filter(passGlobal); const c={T1:0,T2:0,T3:0,T0:0,TX:0},s={T1:0,T2:0,T3:0,T0:0,TX:0};
  for(const x of L){c[x.tier]++;s[x.tier]+=x.max;} let a=0,v=0; for(const o of MSTAT.values()){Object.values(o).includes('A')?a++:v++;}
  return {tier1:{isps:c.T1,assinantes:s.T1},tier2:{isps:c.T2,assinantes:s.T2},tier3:{isps:c.T3,assinantes:s.T3},sem_comprador:c.T0,excluidos:c.TX,municipios_alvo:a+v,municipios_atua:a,municipios_vizinhos:v,isps_total:L.length}; }
function munInfo(id){ const m=MUN.get(id); if(!m) return null; const o=MSTAT.get(id)||{}; const r={municipio:m.n,uf:m.uf,ibge:m.id,cep_cod:m.cep,vizinhos_ibge:m.nb.slice(),assin_alares:DATA.alares[id]??null,isps_sediados:(ISP_BY_MUN.get(id)||[]).map(s=>s.cnpj||s.nome)};
  for(const b of BUY) r['area_'+b.name]=o[b.id]==='A'?'Atua':o[b.id]==='V'?'Vizinho':''; return r; }
function findIsp(q){ if(typeof q==='number') return ISPS[q]; const n=String(q).replace(/\D/g,''); return ISPS.find(s=>(n&&s.cnpj===n)||s.nome===q); }
const API={
  versao:VERSION,
  parametros:()=>JSON.parse(JSON.stringify(P)),
  setParametros:o=>{ Object.assign(P,o||{}); for(const k of ['t1','t2','cap']) document.getElementById(k).value=P[k]; update(); return API.parametros(); },
  resetParametros:()=>{ document.getElementById('reset').click(); return API.parametros(); },
  matriz:(todos)=>matriz(todos?ISPS:ispFiltered()),
  municipios:()=>munExport(),
  resumo:()=>kpiResumo(),
  isp:(q)=>{ const s=findIsp(q); return s?matriz([s])[0]:null; },
  municipio:(ibge)=>munInfo(+ibge),
  selecionarISP:(q)=>{ const s=findIsp(q); if(!s) return false; goTab('mapa'); showIsp(s,'detail'); if(s.ibge) zoomToMun(s.ibge); return true; },
  selecionarMunicipio:(ibge)=>{ ibge=+ibge; if(!MUN.has(ibge)) return false; goTab('mapa'); showMun(ibge); zoomToMun(ibge); return true; },
  excluirISP:(q,excluir=true)=>{ const s=findIsp(q); if(!s) return false; P.excl=P.excl.filter(x=>x!==s.key); if(excluir) P.excl.push(s.key); update(); return true; },
  adicionarComprador:(nome,linhas,vizinhos=true)=>{ const ids=[],nao=[]; for(const l of linhas){ const uf=(l.uf||'').toUpperCase(); const id= l.ibge? +l.ibge : NAMEKEY.get(uf+'|'+norm(l.municipio||'')); (id&&MUN.has(id))?ids.push(id):nao.push(l); }
    if(ids.length){ P.custom.push({name:nome,ids:[...new Set(ids)]}); P.nb['c'+(P.custom.length-1)]=!!vizinhos; update(); } return {reconhecidos:ids.length,nao_reconhecidos:nao}; },
  irPara:(aba)=>goTab(aba),
  exportarCSV:(tipo)=>document.getElementById(tipo==='municipios'?'exp-mun':'exp-isp').click(),
  on:(evento,fn)=>{ const h=e=>fn(e.detail); window.addEventListener(evento,h); return ()=>window.removeEventListener(evento,h); },
  isps:ISPS, municipiosBase:MUN
};
window.ApeltrysMap=API;

// ---------- notes ----------
function renderNotes(){
  const at=DATA.alaresTotUF; const alUF={}; for(const [k,v] of Object.entries(DATA.alares)){const u=MUN.get(+k).uf; alUF[u]=(alUF[u]||0)+v;}
  const noSede=ISPS.filter(s=>!s.ibge);
  document.getElementById('notes').innerHTML=`
  <h2>Objetivo</h2>
  <p>Montar a lista priorizada de ISPs para abordagem. Um ISP é alvo quando tem um comprador natural (Nio, Zaaz/Sky, Alares ou outros players) e tamanho suficiente. O comprador natural é quem atua no município sede do ISP ou num município vizinho, ou a Sky pela regra de tamanho. A partir disso, o corte de assinantes define o Tier 1 de buscas.</p>
  <h2>Regras aplicadas</h2>
  <ul>
   <li><b>Nio</b>: compra nos municípios onde está (${DATA.nio.length} municípios).</li>
   <li><b>Zaaz/Sky</b>: compra nos municípios da rede (${DATA.zaaz.length}). <b>Fora deles, compra ISP com mais de ${fmt(P.skyMin)} assinantes</b> <span class="tbc">TBC</span>. Hoje a regra vale para o ISP no Brasil todo.</li>
   <li><b>Alares</b>: lista de ${Object.keys(DATA.alares).length} municípios com assinantes (fonte Anatel, enviada pelo Gaunzer). Vários municípios têm só 1 a 5 assinantes, por isso existe o corte de presença, hoje em ${fmt(P.alaresMin)} e ajustável no painel. A Alares informa que <b>municípios que fazem divisa com a sua cobertura são targets</b>.</li>
   <li><b>Vizinhos</b>: para cada comprador, o mapa soma à área dele os municípios que fazem divisa com ela, usando a base de divisas. Dá para ligar e desligar por comprador.</li>
   <li><b>Outros players menores</b>: podem comprar, mas a lista ainda não foi recebida. Dá para colar a lista no painel esquerdo.</li>
   <li><b>Excluídos</b>: os próprios compradores presentes na base saem da lista: ${(DATA.excl_padrao||[]).map(i=>esc(ISPS[i].nome)+(ISPS[i].cnpj?' (CNPJ '+ISPS[i].cnpj+')':'')).join(', ')}. A lista fica em scripts/config.json. A Nio não aparece com esse nome na base. Qualquer ISP pode ser excluído ou reincluído no painel de detalhe dele.</li>
   <li><b>Tiers</b>: Tier 1 vai de ${fmt(P.t1)} assinantes para cima e Tier 2 de ${fmt(P.t2)} a ${fmt(P.t1-1)}. O Tier 3 reúne quem tem comprador e está abaixo do Tier 2. ISPs acima de ${fmt(P.cap)} assinantes são ignorados (operadoras e consolidadores). Todos os cortes são parâmetros.</li>
  </ul>
  <div class="warn"><b>Limitação importante:</b> a base Anatel enviada traz <b>um município por ISP, o da sede</b>, e não a presença do ISP em cada município. O cruzamento é feito pela <b>sede</b>, então um ISP sediado fora da área mas com clientes dentro dela não aparece como alvo geográfico. Além disso, <b>${fmt(noSede.length)} dos ${fmt(ISPS.length)} ISPs não têm município sede</b> na base. Esses ISPs entram na matriz e no filtro "Sem município sede", mas só ganham comprador pela regra da Sky (≥ ${fmt(P.skyMin)}). Com a base Anatel de acessos por município e prestadora, o cruzamento passaria a ser por presença real.</div>
  <h2>Fontes</h2>
  <table><thead><tr><th>Arquivo</th><th>Conteúdo</th><th class="n">Registros</th></tr></thead><tbody>
   <tr><td>nio.xlsx</td><td>Municípios onde a Nio está e compra</td><td class="n">${DATA.nio.length}</td></tr>
   <tr><td>zaaz.xlsx</td><td>Municípios da rede Zaaz/Sky. O título interno da planilha diz "Cidades | NIO Internet", provavelmente cópia do modelo.</td><td class="n">${DATA.zaaz.length}</td></tr>
   <tr><td>data_11_s.xlsx</td><td>Municípios e assinantes da Alares (lista do Gaunzer)</td><td class="n">${Object.keys(DATA.alares).length}</td></tr>
   <tr><td>Base_ISPs_com_regressao_v2.xlsx</td><td>Base Anatel de ISPs (Marcos Karpovas): assinantes jan–mai/2026, tendência mensal (regressão), porte, sede e sócios</td><td class="n">${fmt(ISPS.length)}</td></tr>
   <tr><td>Municipios_Brasil_Divisas_CEP.xlsx</td><td>${fmt(MUN.size)} municípios com código (1º CEP), código IBGE e divisas</td><td class="n">${fmt(MUN.size)}</td></tr>
  </tbody></table>
  <h2>Alares: clusters informados</h2>
  <p><b>Cluster Nordeste</b> (slide Alares, fonte Anatel):</p>
  <table><thead><tr><th>Cluster</th><th class="n">Subs (slide)</th><th>Cidade principal</th><th class="n">Total na planilha</th></tr></thead><tbody>
   <tr><td>CE</td><td class="n">124.300</td><td>Fortaleza</td><td class="n">${fmt(at.CE)}</td></tr>
   <tr><td>RN</td><td class="n">147.400</td><td>Natal</td><td class="n">${fmt(at.RN)}</td></tr>
   <tr><td>PB</td><td class="n">11.500</td><td>João Pessoa</td><td class="n">${fmt(at.PB)}</td></tr>
   <tr><td>BA</td><td class="n">18.300</td><td>Porto Seguro</td><td class="n">${fmt(at.BA)}</td></tr>
   <tr><td><b>Total</b></td><td class="n"><b>301.500</b></td><td></td><td class="n">${fmt(at.CE+at.RN+at.PB+at.BA)}</td></tr></tbody></table>
  <p><b>Cluster SP e entorno</b> (mapa): manchas no interior de SP (centro-oeste, Ribeirão Preto/Franca, Vale do Ribeira e litoral sul), sul de MG e norte do PR. Os municípios exatos vêm da planilha.</p>
  <p>Totais por UF da planilha Alares (linha "Total") e soma das linhas por município:</p>
  <table><thead><tr><th>UF</th><th class="n">Total (planilha)</th><th class="n">Soma dos municípios</th></tr></thead><tbody>
   ${Object.keys(at).filter(k=>k!=='TOTAL').map(u=>`<tr><td>${u}</td><td class="n">${fmt(at[u])}</td><td class="n">${alUF[u]!=null?fmt(alUF[u]):'<span class="muted">sem municípios listados</span>'}</td></tr>`).join('')}
   <tr><td><b>Total</b></td><td class="n"><b>${fmt(at.TOTAL)}</b></td><td class="n"><b>${fmt(Object.values(alUF).reduce((a,b)=>a+b,0))}</b></td></tr></tbody></table>
  <h2>Tratamento dos dados</h2>
  <ul>
   <li>Todas as bases foram casadas pelo <b>código IBGE</b> (aba "Apoio" da base de divisas), comparando nome do município e UF sem acentos.</li>
   <li>Grafias antigas ou diferentes foram corrigidas: Itapagé → Itapajé (CE), Embu → Embu das Artes, Moji Mirim → Mogi Mirim, Brasópolis → Brazópolis, São Thomé das Letras → São Tomé das Letras, Arês → Arez (RN), Balneário de Piçarras → Balneário Piçarras, Bom Jesus (GO) → Bom Jesus de Goiás, Santa Teresinha (BA) → Santa Terezinha, Santa Isabel do Pará → Santa Izabel do Pará, Santana do Livramento → Sant'Ana do Livramento. Com isso, 100% das listas casaram.</li>
   <li>Na base de divisas, Buritirana e Senador La Rocque (MA) têm o mesmo código de CEP, 65935. Por isso, uma divisa que aponte para 65935 é atribuída aos dois municípios.</li>
   <li>Sete municípios mais recentes não têm polígono no mapa: Paraíso das Águas/MS, Boa Esperança do Norte/MT, Mojuí dos Campos/PA, Nazária/PI, Pinto Bandeira/RS, Balneário Rincão/SC e Pescaria Brava/SC. Eles aparecem nas tabelas normalmente.</li>
   <li>Na base Anatel, "Assinantes" é o maior valor mensal entre jan e mai/2026 (coluna "Máximo"), e "Tendência" é a coluna de inclinação mensal da regressão. A coluna O (0/1) foi mantida como "flag", mas o significado dela precisa ser confirmado com o Marcos. As colunas Status e Quem estão vazias na base e já saem na exportação, prontas para o funil.</li>
   <li>Mapa municipal: malha IBGE (via geodata-br), simplificada para visualização.</li>
   <li>Versão dos dados: ${esc(DATA.versao||'')} · gerado em ${esc(DATA.gerado_em||'')}.</li>
  </ul>
  <h2>Integração com o funil</h2>
  <p>Na Matriz de ISPs, o botão <b>Enviar ao funil</b> manda os ISPs filtrados (Tier 1, 2 e 3) que ainda não estão no funil para a <b>etapa 1 — ISP identificado</b>, na fila de atendimento e sem responsável. Também dá para enviar um ISP só, pela linha da tabela ou pelo detalhe. Seguem junto: tier, compradores, assinantes e os contatos dos sócios. ISPs já presentes no funil (mesmo CNPJ ou mesmo ISP do mapa) não são duplicados.</p>
  <p>Os parâmetros (cortes, compradores, outros players e exclusões) ficam salvos no servidor e valem para toda a gestão. Os botões no topo exportam a matriz e os municípios em CSV e JSON, com os filtros atuais. Os dados ficam só no DealSourcing, com acesso restrito a admin e gestão (LGPD).</p>`;
}

// ---------- update ----------
function update(skipSave){
  if(!skipSave) save(); compute(); renderBuyers(); renderColorBy(); renderBuyerFilter(); renderKpis(); renderLegend();
  if(W) draw(); renderIspTable(); renderMunTable(); renderNotes();
  if(selIsp && document.getElementById('detail').innerHTML.includes(esc(selIsp.nome))) showIsp(selIsp,'detail');
  else if(selMun!=null) showMun(selMun);
  emit('apeltrys:atualizado',{parametros:API.parametros(),resumo:kpiResumo()});
}
setFunnel=f=>{ FUN=f; update(true); };
update(true);
window.addEventListener('resize',()=>{ if(document.getElementById('v-mapa').classList.contains('on')) layout(); });
requestAnimationFrame(layout);
} // start
})();
