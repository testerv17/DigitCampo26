let gmap, marker, iw;
let session = null; // { username, bucket, displayName }
let lastLatLng = null;

let gpsWatchId = null;
let gpsTracking = false;

const $ = (id)=>document.getElementById(id);

// === EQUIPOS (exactos de tus imágenes) ===
const EQUIPOS_LIST = [
  "PCR-11-500",
  "PCR_12_750",
  "PCR_13_600",
  "PCR_7_500",
  "PMC_12_3",
  "PMC_14_3",
  "TR_D1_37_5_13200",
  "TR_D1_37_5_33000",
  "TR_DC1_15_13200",
  "TR_DC1_15_33000",
  "TR_DC125_13200",
  "TR_DC1_25_33000",
  "TR_DC1_50_13200",
  "TR_DC1_50_33000",
  "REG_BT",
  "REG_MT",
  "REST",
  "BCOCAP",
  "SW",
  "COGC",
  "CSA"
];

function fillEquiposSelect(){
  const sel = $("equipo");
  if(!sel) return;
  sel.innerHTML = `<option value="">— Selecciona equipo —</option>`;
  EQUIPOS_LIST.forEach(e=>{
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    sel.appendChild(opt);
  });
}

function nowString(){
  const d = new Date();
  const pad = (n)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function show(el, yes){
  if(!el) return;
  el.classList.toggle("d-none", !yes);
}

function setChip(text, tone){
  $("statusChip").textContent = text;
  const chip = $("statusChip");
  chip.style.borderColor = "rgba(255,255,255,.10)";
  chip.style.background = "rgba(0,0,0,.22)";
  if(tone==="ok"){ chip.style.background = "rgba(45,227,143,.14)"; }
  if(tone==="warn"){ chip.style.background = "rgba(255,204,102,.14)"; }
  if(tone==="bad"){ chip.style.background = "rgba(255,77,90,.14)"; }
}

function initMap(){
  const center = { lat: 25.6866, lng: -100.3161 };
  gmap = new google.maps.Map($("map"), {
    center,
    zoom: 12,
    disableDefaultUI: true,
    zoomControl: true
  });
  iw = new google.maps.InfoWindow();
}

function setMapPoint(lat, lng){
  lastLatLng = { lat, lng };
  $("latitud").value = String(lat);
  $("longitud").value = String(lng);

  if(!gmap) return;

  const pos = { lat, lng };
  gmap.panTo(pos);
  gmap.setZoom(Math.max(gmap.getZoom(), 16));

  if(marker) marker.setMap(null);
  marker = new google.maps.Marker({
    position: pos,
    map: gmap,
    title: "Punto capturado"
  });
}

async function login(){
  const u = ($("loginUser").value || "").trim();
  const p = ($("loginPass").value || "").trim();

  show($("loginErr"), false);
  if(!u || !p){
    $("loginErr").textContent = "Escribe usuario y contraseña.";
    show($("loginErr"), true);
    return;
  }

  setChip("Validando...", "warn");

  const snap = await db.ref("Usuarios/" + u).once("value");
  const user = snap.val();

  if(!user || !user.pass){
    $("loginErr").textContent = "Usuario no encontrado.";
    show($("loginErr"), true);
    setChip("Listo", "neutral");
    return;
  }
  if(String(user.pass) !== p){
    $("loginErr").textContent = "Contraseña incorrecta.";
    show($("loginErr"), true);
    setChip("Listo", "neutral");
    return;
  }

  const bucket = String(user.bucket || "").trim().toUpperCase();
  // permite: DIG1..DIG999 y DIG2_PTE etc
  if(!bucket || !/^DIG\d+(_PTE)?$/i.test(bucket)){
    $("loginErr").textContent = "Tu usuario no tiene bucket asignado válido (ej: DIG1, DIG2_PTE).";
    show($("loginErr"), true);
    setChip("Listo", "neutral");
    return;
  }

  session = {
    username: u,
    bucket: bucket,
    displayName: user.displayName || u
  };

  localStorage.setItem("dig_session", JSON.stringify(session));

  $("whoLine").textContent = `Usuario: ${session.displayName}`;
  $("bucketLine").textContent = `Bucket asignado: ${session.bucket}`;

  show($("loginCard"), false);
  show($("app"), true);
  show($("btnLogout"), true);

  setChip("Conectado", "ok");
  $("fecha_hora").value = nowString();

  setTimeout(()=>{
    if(!gmap && window.google && google.maps) initMap();
    loadToday();
  }, 60);
}

function logout(){
  // apaga tracking si estaba activo
  if(gpsWatchId !== null){
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  gpsTracking = false;
  $("btnGPS").textContent = "📍 Tomar GPS";

  localStorage.removeItem("dig_session");
  session = null;
  show($("app"), false);
  show($("btnLogout"), false);
  show($("loginCard"), true);
  setChip("Listo", "neutral");
}

function getGPS(){
  show($("okBox"), false);
  show($("warnBox"), false);

  if(!navigator.geolocation){
    $("warnBox").textContent = "Tu navegador no soporta GPS.";
    show($("warnBox"), true);
    return;
  }

  // Toggle: iniciar / detener tracking
  if(gpsTracking){
    if(gpsWatchId !== null){
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }
    gpsTracking = false;
    setChip("Tracking OFF", "neutral");
    $("btnGPS").textContent = "📍 Tomar GPS";
    $("okBox").textContent = "Tracking detenido.";
    show($("okBox"), true);
    return;
  }

  setChip("Tracking ON...", "warn");
  $("btnGPS").textContent = "🛰️ Detener Tracking";
  gpsTracking = true;

  gpsWatchId = navigator.geolocation.watchPosition(
    (pos)=>{
      const lat = Number(pos.coords.latitude);
      const lng = Number(pos.coords.longitude);

      if(Number.isFinite(lat) && Number.isFinite(lng)){
        setMapPoint(lat, lng);
        $("fecha_hora").value = nowString();
        setChip("GPS OK (Tracking)", "ok");
      }
    },
    ()=>{
      setChip("GPS error", "bad");
      $("warnBox").textContent = "No se pudo tomar GPS. Activa ubicación y permisos.";
      show($("warnBox"), true);

      gpsTracking = false;
      $("btnGPS").textContent = "📍 Tomar GPS";
      if(gpsWatchId !== null){
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
      }
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 1000 }
  );
}

async function savePoint(){
  show($("okBox"), false);
  show($("warnBox"), false);

  if(!session){
    $("warnBox").textContent = "Sesión no válida. Inicia sesión otra vez.";
    show($("warnBox"), true);
    return;
  }

  const equipo = ($("equipo").value || "").trim();
  const comentario = ($("comentario").value || "").trim();
  const fecha_hora = ($("fecha_hora").value || nowString()).trim();
  const lat = Number($("latitud").value);
  const lng = Number($("longitud").value);

  if(!equipo){
    $("warnBox").textContent = "Selecciona el Equipo.";
    show($("warnBox"), true);
    return;
  }
  if(!Number.isFinite(lat) || !Number.isFinite(lng)){
    $("warnBox").textContent = "Primero toma el GPS.";
    show($("warnBox"), true);
    return;
  }

  setChip("Guardando...", "warn");

  // num único simple (si necesitas incremental real por día, lo ajustamos)
  const num = String(Date.now());

  const payload = {
    num: num,
    equipo: equipo,
    comentario: comentario || "",
    fecha_hora: fecha_hora,
    latitud: String(lat),
    longitud: String(lng),
    user: session.username
  };

  await db.ref(session.bucket).push(payload);

  setChip("Guardado", "ok");
  $("okBox").textContent = `Guardado en ${session.bucket}.`;
  show($("okBox"), true);

  $("comentario").value = "";
  $("fecha_hora").value = nowString();

  loadToday();
}

async function loadToday(){
  if(!session) return;

  const start = new Date();
  start.setHours(0,0,0,0);

  const snap = await db.ref(session.bucket).limitToLast(80).once("value");
  const data = snap.val() || {};
  const items = Object.keys(data).map(k=>({ key:k, v:data[k] || {} }));

  items.sort((a,b)=>{
    const da = new Date(String(a.v.fecha_hora || "").replace(" ", "T"));
    const dbb = new Date(String(b.v.fecha_hora || "").replace(" ", "T"));
    return dbb - da;
  });

  const today = items.filter(it=>{
    const d = new Date(String(it.v.fecha_hora || "").replace(" ", "T"));
    return !isNaN(d) && d >= start;
  }).slice(0, 14);

  const box = $("todayList");
  box.innerHTML = "";

  if(today.length === 0){
    box.innerHTML = `<div class="hint">Aún no hay capturas hoy.</div>`;
    return;
  }

  today.forEach(it=>{
    const v = it.v || {};
    const eq = (v.equipo || "N/A");
    const fh = (v.fecha_hora || "—");
    const cm = (v.comentario || "");
    const lt = (v.latitud || "");
    const lg = (v.longitud || "");

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="item-top">
        <div><b>${eq}</b><small>${cm}</small><small>${fh}</small></div>
        <span class="badge2">OK</span>
      </div>
      <small>Lat: ${lt} · Lng: ${lg}</small>
    `;

    el.addEventListener("click", ()=>{
      const lat = Number(lt), lng = Number(lg);
      if(Number.isFinite(lat) && Number.isFinite(lng)){
        setMapPoint(lat, lng);
        if(iw && marker){
          iw.setContent(`<b>${eq}</b><br>${cm}<br><small>${fh}</small>`);
          iw.open(gmap, marker);
        }
      }
    });

    box.appendChild(el);
  });
}

function updateNet(){
  const dot = $("netDot");
  if(navigator.onLine){
    dot.classList.remove("bad"); dot.classList.add("ok");
  }else{
    dot.classList.remove("ok"); dot.classList.add("bad");
  }
}

window.addEventListener("online", updateNet);
window.addEventListener("offline", updateNet);

window.addEventListener("load", ()=>{
  updateNet();
  fillEquiposSelect();

  // restore session
  const s = localStorage.getItem("dig_session");
  if(s){
    try{
      session = JSON.parse(s);
      show($("loginCard"), false);
      show($("app"), true);
      show($("btnLogout"), true);

      $("whoLine").textContent = `Usuario: ${session.displayName || session.username}`;
      $("bucketLine").textContent = `Bucket asignado: ${session.bucket}`;
      setChip("Conectado", "ok");
      $("fecha_hora").value = nowString();

      const wait = setInterval(()=>{
        if(window.google && google.maps){
          clearInterval(wait);
          initMap();
          loadToday();
        }
      }, 150);
    }catch(e){
      logout();
    }
  }

  $("btnLogin").addEventListener("click", login);
  $("btnLogout").addEventListener("click", logout);
  $("btnGPS").addEventListener("click", getGPS);
  $("btnSave").addEventListener("click", savePoint);
});
