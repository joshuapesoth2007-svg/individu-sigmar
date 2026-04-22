/* ===== WebGIS Pemukiman Winangun II - Joshua Pesoth (241011060004) ===== */

document.getElementById('yr').textContent = new Date().getFullYear();

/* ---------- Theme ---------- */
const themeBtn = document.getElementById('themeToggle');
const setTheme = (dark) => {
  document.documentElement.classList.toggle('dark', dark);
  themeBtn.innerHTML = dark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  localStorage.setItem('theme', dark ? 'dark' : 'light');
};
setTheme(localStorage.getItem('theme') === 'dark' ||
  (!localStorage.getItem('theme') && matchMedia('(prefers-color-scheme: dark)').matches));
themeBtn.onclick = () => setTheme(!document.documentElement.classList.contains('dark'));

/* ---------- Navigation (hash router) ---------- */
const pages = ['home','peta','tentang','kontak'];
function navigate(id){
  if(!pages.includes(id)) id = 'home';
  pages.forEach(p => document.getElementById(p).classList.toggle('active', p === id));
  document.querySelectorAll('.nav-link').forEach(a =>
    a.classList.toggle('active', a.dataset.nav === id));
  window.scrollTo(0,0);
  if(id === 'peta' && map) setTimeout(() => map.invalidateSize(), 200);
}
document.querySelectorAll('[data-nav]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    location.hash = a.dataset.nav;
  });
});
window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));

document.getElementById('menuToggle').onclick = () =>
  document.querySelector('.nav-links').classList.toggle('open');

/* ---------- Loader ---------- */
window.addEventListener('load', () => {
  setTimeout(() => document.getElementById('loader').classList.add('hide'), 500);
  navigate(location.hash.slice(1) || 'home');
  initApp();
});

/* ---------- App ---------- */
let map, baseLayer, pemLayer, boundLayer;
const features = json_pemukiman.features;
const densityColor = { Padat:'#ef4444', Sedang:'#f59e0b', Jarang:'#10b981' };
const basemaps = {
  osm:  { url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr:'© OSM' },
  sat:  { url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'© Esri' },
  dark: { url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr:'© CARTO' },
};
let state = { basemap:'osm', showPem:true, showBound:true, density:'all', q:'' };

function initApp(){
  initMap();
  renderStats();
  renderCharts();
  bindControls();
  refreshLayers();
}

function initMap(){
  map = L.map('map', { zoomControl:false, minZoom:13, maxZoom:19 })
        .setView([1.4475, 124.8385], 15);
  L.control.zoom({ position:'bottomright' }).addTo(map);
  baseLayer = L.tileLayer(basemaps.osm.url, { attribution: basemaps.osm.attr }).addTo(map);
}

function refreshLayers(){
  // basemap
  if(baseLayer) map.removeLayer(baseLayer);
  baseLayer = L.tileLayer(basemaps[state.basemap].url, { attribution: basemaps[state.basemap].attr }).addTo(map);

  // boundary
  if(boundLayer){ map.removeLayer(boundLayer); boundLayer = null; }
  if(state.showBound){
    boundLayer = L.geoJSON(json_boundary, {
      style:{ color:'#8b5cf6', weight:3, fillOpacity:.04, dashArray:'6 4' }
    }).addTo(map);
  }

  // pemukiman (filtered)
  if(pemLayer){ map.removeLayer(pemLayer); pemLayer = null; }
  if(!state.showPem) return updateCount(0);

  const q = state.q.toLowerCase();
  const filtered = features.filter(f => {
    const p = f.properties;
    if(state.density !== 'all' && p.density !== state.density) return false;
    if(q && ![p.name,p.rt,p.rw,p.density].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });

  pemLayer = L.geoJSON({ type:'FeatureCollection', features:filtered }, {
    style: f => ({
      color: densityColor[f.properties.density],
      weight: 1.5,
      fillColor: densityColor[f.properties.density],
      fillOpacity: .55,
    }),
    onEachFeature: (f, layer) => {
      const p = f.properties;
      layer.bindPopup(`
        <div style="min-width:200px">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px">${p.name}</div>
          <div style="font-size:12px;line-height:1.7;opacity:.85">
            <div><b>${p.rt} / ${p.rw}</b></div>
            <div>Jumlah rumah: <b>${p.houses}</b></div>
            <div>Kepadatan: <span style="color:${densityColor[p.density]};font-weight:600">${p.density}</span></div>
            <div>Jenis: ${p.type}</div>
            <div style="margin-top:6px;font-style:italic;opacity:.7">${p.notes}</div>
          </div>
        </div>`);
      layer.on('click', () => showSelected(p));
      layer.on('mouseover', e => e.target.setStyle({ weight:3, fillOpacity:.8 }));
      layer.on('mouseout',  e => e.target.setStyle({ weight:1.5, fillOpacity:.55 }));
    }
  }).addTo(map);

  updateCount(filtered.length);
}

function updateCount(n){
  document.getElementById('countInfo').innerHTML =
    `Menampilkan <b>${n}</b> dari ${features.length} blok`;
}

function showSelected(p){
  const el = document.getElementById('selectedInfo');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
      <i class="fa-solid fa-house" style="color:var(--primary)"></i>
      <strong>${p.name}</strong>
    </div>
    <div style="font-size:.8rem;color:var(--muted);line-height:1.6">
      <div>${p.rt} · ${p.rw}</div>
      <div>${p.houses} rumah · <span style="color:${densityColor[p.density]};font-weight:600">${p.density}</span></div>
      <div>${p.type}</div>
    </div>`;
}

/* ---------- Controls ---------- */
function bindControls(){
  document.getElementById('togglePem').onchange = e => { state.showPem = e.target.checked; refreshLayers(); };
  document.getElementById('toggleBound').onchange = e => { state.showBound = e.target.checked; refreshLayers(); };
  document.getElementById('searchInput').oninput = e => { state.q = e.target.value; refreshLayers(); };

  document.querySelectorAll('#basemapSeg button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#basemapSeg button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.basemap = b.dataset.bm;
    refreshLayers();
  });
  document.querySelectorAll('#densitySeg button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#densitySeg button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.density = b.dataset.d;
    refreshLayers();
  });

  document.getElementById('sbToggle').onclick = () =>
    document.getElementById('sidebar').classList.toggle('hidden');
  document.getElementById('btnLocate').onclick = () => map.locate({ setView:true, maxZoom:17 });
  document.getElementById('btnFs').onclick = () => document.getElementById('map').requestFullscreen?.();
  document.getElementById('btnReset').onclick = () => map.setView([1.4475, 124.8385], 15);
}

/* ---------- Stats & Charts ---------- */
function renderStats(){
  const c = { Padat:0, Sedang:0, Jarang:0 };
  let houses = 0;
  features.forEach(f => { c[f.properties.density]++; houses += f.properties.houses; });
  document.getElementById('stTotal').textContent = features.length;
  document.getElementById('stHouses').textContent = houses.toLocaleString('id-ID');
  document.getElementById('stPadat').textContent = c.Padat;
  document.getElementById('stJarang').textContent = c.Jarang;
}

function renderCharts(){
  const c = { Padat:0, Sedang:0, Jarang:0 };
  const t = {};
  features.forEach(f => {
    c[f.properties.density]++;
    t[f.properties.type] = (t[f.properties.type] || 0) + 1;
  });

  new Chart(document.getElementById('chartDensity'), {
    type:'doughnut',
    data:{ labels:Object.keys(c), datasets:[{ data:Object.values(c),
      backgroundColor:['#ef4444','#f59e0b','#10b981'], borderWidth:0 }] },
    options:{ maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
  });

  new Chart(document.getElementById('chartType'), {
    type:'bar',
    data:{ labels:Object.keys(t), datasets:[{ label:'Jumlah blok', data:Object.values(t),
      backgroundColor:['#8b5cf6','#06b6d4','#ec4899'], borderRadius:8 }] },
    options:{ maintainAspectRatio:false, plugins:{ legend:{ display:false } } }
  });
}
