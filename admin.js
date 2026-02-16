const $ = (id)=>document.getElementById(id);

function msg(el, text){
  el.textContent = text;
  el.classList.remove("d-none");
  setTimeout(()=> el.classList.add("d-none"), 3500);
}

function normBucket(b){
  return String(b || "").trim().toUpperCase();
}

function validBucket(b){
  return /^DIG\d+(_PTE)?$/i.test(b);
}

async function saveUser(){
  const username = String($("uUser").value || "").trim();
  const pass = String($("uPass").value || "").trim();
  const bucket = normBucket($("uBucket").value);
  const displayName = String($("uName").value || "").trim();

  if(!username || !pass){
    msg($("uMsg"), "Falta username o password.");
    return;
  }
  if(!bucket || !validBucket(bucket)){
    msg($("uMsg"), "Bucket inválido. Ej: DIG1 o DIG2_PTE o DIG20");
    return;
  }

  await db.ref("Usuarios/" + username).set({
    pass,
    bucket,
    displayName: displayName || username
  });

  msg($("uMsg"), `Usuario ${username} guardado con bucket ${bucket}.`);
}

async function loadUser(){
  const username = String($("uUser").value || "").trim();
  if(!username){
    msg($("uMsg"), "Escribe username para cargar.");
    return;
  }
  const snap = await db.ref("Usuarios/" + username).once("value");
  const u = snap.val();
  if(!u){
    msg($("uMsg"), "No existe ese usuario.");
    return;
  }
  $("uPass").value = u.pass || "";
  $("uBucket").value = u.bucket || "";
  $("uName").value = u.displayName || "";
  msg($("uMsg"), "Usuario cargado.");
}

async function createBuckets(){
  const from = Number($("bFrom").value);
  const to = Number($("bTo").value);
  const suffix = String($("bSuffix").value || "").trim().toUpperCase();

  if(!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to < from){
    msg($("bMsg"), "Rango inválido.");
    return;
  }

  const updates = {};
  for(let i=from; i<=to; i++){
    const name = `DIG${i}${suffix}`;
    // forzamos existencia del nodo con un meta
    updates[`${name}/_meta`] = { createdAt: Date.now(), createdBy: "admin" };
  }

  await db.ref().update(updates);
  msg($("bMsg"), `Buckets creados/asegurados: DIG${from}${suffix} .. DIG${to}${suffix}`);
}

function genJsonTemplate(){
  // Plantilla mínima: Usuarios + 6 buckets base
  const json = {
    Usuarios: {
      dig1: { pass: "1234", bucket: "DIG1", displayName: "Cuadrilla DIG1" },
      dig2: { pass: "1234", bucket: "DIG2_PTE", displayName: "Cuadrilla DIG2 PTE" },
      dig3: { pass: "1234", bucket: "DIG3", displayName: "Cuadrilla DIG3" }
    },
    DIG1: { _meta: { createdAt: Date.now(), createdBy: "template" } },
    DIG2_PTE: { _meta: { createdAt: Date.now(), createdBy: "template" } },
    DIG3: { _meta: { createdAt: Date.now(), createdBy: "template" } },
    DIG4: { _meta: { createdAt: Date.now(), createdBy: "template" } },
    DIG5: { _meta: { createdAt: Date.now(), createdBy: "template" } },
    DIG6: { _meta: { createdAt: Date.now(), createdBy: "template" } }
  };

  $("jsonOut").value = JSON.stringify(json, null, 2);
}

window.addEventListener("load", ()=>{
  $("btnSaveUser").addEventListener("click", saveUser);
  $("btnLoadUser").addEventListener("click", loadUser);
  $("btnCreateBuckets").addEventListener("click", createBuckets);
  $("btnGenJson").addEventListener("click", genJsonTemplate);
  genJsonTemplate();
});
