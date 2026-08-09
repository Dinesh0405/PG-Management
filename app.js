const DB_NAME="pg_manager_db", DB_VER=1;
let db, installPrompt=null;
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"INR"}).format(Number(n||0));
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VER);r.onupgradeneeded=e=>{const d=e.target.result;["guests","rooms","payments"].forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:"id"})})};r.onsuccess=()=>{db=r.result;resolve(db)};r.onerror=()=>reject(r.error)})}
function tx(store,mode="readonly"){return db.transaction(store,mode).objectStore(store)}
function all(store){return new Promise((res,rej)=>{const r=tx(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(store,obj){return new Promise((res,rej)=>{const r=tx(store,"readwrite").put(obj);r.onsuccess=()=>res(obj);r.onerror=()=>rej(r.error)})}
function del(store,id){return new Promise((res,rej)=>{const r=tx(store,"readwrite").delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function toast(t){const x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2200)}
function showView(v){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===v));document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view===v));render(v)}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{showView(b.dataset.go);setTimeout(()=>window[b.dataset.action==="new"?"openNew"+b.dataset.go[0].toUpperCase()+b.dataset.go.slice(1):"noop"]?.(),50)});

function modal(title,html){$("#modalTitle").textContent=title;$("#modalBody").innerHTML=html;$("#modal").classList.remove("hidden")}
$("#closeModal").onclick=()=>$("#modal").classList.add("hidden");
$("#modal").onclick=e=>{if(e.target.id==="modal")$("#modal").classList.add("hidden")};

async function render(view){
 if(view==="dashboard") await renderDashboard();
 if(view==="guests") await renderGuests();
 if(view==="rooms") await renderRooms();
 if(view==="payments") await renderPayments();
}
async function renderDashboard(){
 const [g,r,p]=await Promise.all([all("guests"),all("rooms"),all("payments")]);
 const occupied=g.filter(x=>x.status!=="Checked Out").length;
 $("#statGuests").textContent=g.length; $("#statOccupied").textContent=occupied;
 $("#statVacant").textContent=Math.max(0,r.reduce((a,x)=>a+Number(x.beds||0),0)-occupied);
 $("#statAdvance").textContent=money(g.reduce((a,x)=>a+Number(x.advancePaid||0),0));
 $("#statPending").textContent=money(g.reduce((a,x)=>a+Math.max(0,Number(x.monthlyRent||0)-Number(x.currentMonthPaid||0)),0));
 const recent=g.slice(-5).reverse();
 $("#recentGuests").innerHTML=recent.length?recent.map(guestRow).join(""):'<div class="empty">No guests yet.</div>';
}
function guestRow(g){return `<div class="list-row"><div class="guest-cell"><div class="avatar">${g.photo?`<img class="avatar" src="${g.photo}">`:escapeHtml((g.name||"?")[0].toUpperCase())}</div><div><b>${escapeHtml(g.name)}</b><div class="muted">${escapeHtml(g.room||"No room")} · ${escapeHtml(g.phone||"")}</div></div></div><span class="badge">${escapeHtml(g.status||"Active")}</span></div>`}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

async function renderGuests(){
 const gs=await all("guests"), q=($("#guestSearch")?.value||"").toLowerCase();
 const rows=gs.filter(g=>[g.name,g.phone,g.room,g.idNumber].some(v=>String(v||"").toLowerCase().includes(q)));
 $("#guestList").innerHTML=rows.length?`<table class="table"><thead><tr><th>Guest</th><th>Room</th><th>Check-in</th><th>Rent</th><th>Advance</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(g=>`<tr><td>${guestRow(g)}</td><td>${escapeHtml(g.room||"-")}</td><td>${escapeHtml(g.checkIn||"-")}</td><td>${money(g.monthlyRent)}</td><td>${money(g.advancePaid)}</td><td><span class="badge">${escapeHtml(g.status||"Active")}</span></td><td><div class="small-actions"><button class="secondary" onclick="editGuest('${g.id}')">Edit</button><button class="danger" onclick="deleteGuest('${g.id}')">Delete</button></div></td></tr>`).join("")}</tbody></table>`:'<div class="empty">No matching guests.</div>';
}
$("#guestSearch").oninput=renderGuests;
function guestForm(g={}){
 return `<form id="guestForm"><div class="form-grid">
 <div class="field"><label>Full name *</label><input name="name" required value="${escapeHtml(g.name||"")}"></div>
 <div class="field"><label>Mobile *</label><input name="phone" required value="${escapeHtml(g.phone||"")}"></div>
 <div class="field"><label>Email</label><input type="email" name="email" value="${escapeHtml(g.email||"")}"></div>
 <div class="field"><label>Date of birth</label><input type="date" name="dob" value="${escapeHtml(g.dob||"")}"></div>
 <div class="field"><label>ID type</label><select name="idType"><option ${g.idType==="Aadhaar"?"selected":""}>Aadhaar</option><option ${g.idType==="Passport"?"selected":""}>Passport</option><option ${g.idType==="Driving License"?"selected":""}>Driving License</option><option ${g.idType==="Other"?"selected":""}>Other</option></select></div>
 <div class="field"><label>ID number</label><input name="idNumber" value="${escapeHtml(g.idNumber||"")}"></div>
 <div class="field"><label>Room / Bed</label><input name="room" placeholder="e.g. 203-B" value="${escapeHtml(g.room||"")}"></div>
 <div class="field"><label>Check-in date</label><input type="date" name="checkIn" value="${escapeHtml(g.checkIn||new Date().toISOString().slice(0,10))}"></div>
 <div class="field"><label>Expected checkout</label><input type="date" name="checkOut" value="${escapeHtml(g.checkOut||"")}"></div>
 <div class="field"><label>Status</label><select name="status"><option ${g.status!=="Checked Out"?"selected":""}>Active</option><option ${g.status==="Checked Out"?"selected":""}>Checked Out</option></select></div>
 <div class="field"><label>Monthly rent</label><input type="number" min="0" step="0.01" name="monthlyRent" value="${g.monthlyRent||""}"></div>
 <div class="field"><label>Advance / security deposit paid</label><input type="number" min="0" step="0.01" name="advancePaid" value="${g.advancePaid||""}"></div>
 <div class="field"><label>Current month paid</label><input type="number" min="0" step="0.01" name="currentMonthPaid" value="${g.currentMonthPaid||""}"></div>
 <div class="field"><label>Emergency contact</label><input name="emergency" value="${escapeHtml(g.emergency||"")}"></div>
 <div class="field full"><label>Address</label><textarea name="address">${escapeHtml(g.address||"")}</textarea></div>
 <div class="field"><label>Guest photo</label><input type="file" name="photo" accept="image/*"></div>
 <div class="field"><label>ID / documents (PDF or image)</label><input type="file" name="documents" accept="image/*,.pdf" multiple></div>
 <div class="field full">${g.photo?`<img class="photo-preview" src="${g.photo}">`:""}</div>
 </div><div class="form-actions"><button type="button" class="secondary" onclick="$('#modal').classList.add('hidden')">Cancel</button><button class="primary">Save Guest</button></div></form>`
}
async function fileData(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res({name:file.name,type:file.type,data:r.result});r.onerror=()=>rej(r.error);r.readAsDataURL(file)})}
async function openNewGuests(){modal("Add Guest",guestForm());$("#guestForm").onsubmit=e=>saveGuest(e)}
async function saveGuest(e,id=null){e.preventDefault();const f=new FormData(e.target);let g=id?(await all("guests")).find(x=>x.id===id)||{}:{};g={...g,id:g.id||uid(),name:f.get("name"),phone:f.get("phone"),email:f.get("email"),dob:f.get("dob"),idType:f.get("idType"),idNumber:f.get("idNumber"),room:f.get("room"),checkIn:f.get("checkIn"),checkOut:f.get("checkOut"),status:f.get("status"),monthlyRent:Number(f.get("monthlyRent")||0),advancePaid:Number(f.get("advancePaid")||0),currentMonthPaid:Number(f.get("currentMonthPaid")||0),emergency:f.get("emergency"),address:f.get("address"),photo:g.photo||"",documents:g.documents||[],updatedAt:Date.now()};
 const pf=e.target.photo.files[0];if(pf)g.photo=(await fileData(pf)).data;
 for(const file of e.target.documents.files)g.documents.push(await fileData(file));
 await put("guests",g);$("#modal").classList.add("hidden");toast("Guest saved");await renderGuests();await renderDashboard()}
window.editGuest=async id=>{const g=(await all("guests")).find(x=>x.id===id);modal("Edit Guest",guestForm(g));$("#guestForm").onsubmit=e=>saveGuest(e,id)}
window.deleteGuest=async id=>{if(confirm("Delete this guest and their uploaded documents?")){await del("guests",id);toast("Guest deleted");renderGuests();renderDashboard()}};

async function renderRooms(){const rs=await all("rooms"),gs=await all("guests");$("#roomList").innerHTML=rs.length?rs.map(r=>{const occ=gs.filter(g=>g.room===r.name&&g.status!=="Checked Out").length;return `<div class="room-card"><h3>${escapeHtml(r.name)}</h3><p>${r.type||"Room"} · ${r.beds} beds</p><p><b>${occ}</b> occupied · <b>${Math.max(0,r.beds-occ)}</b> vacant</p><div class="small-actions"><button class="secondary" onclick="editRoom('${r.id}')">Edit</button><button class="danger" onclick="deleteRoom('${r.id}')">Delete</button></div></div>`}).join(""):'<div class="empty">No rooms added.</div>'}
function roomForm(r={}){return `<form id="roomForm"><div class="form-grid"><div class="field"><label>Room name/number *</label><input name="name" required value="${escapeHtml(r.name||"")}"></div><div class="field"><label>Room type</label><select name="type"><option>Single</option><option ${r.type==="Double"?"selected":""}>Double</option><option ${r.type==="Shared"?"selected":""}>Shared</option></select></div><div class="field"><label>Number of beds *</label><input name="beds" type="number" min="1" required value="${r.beds||1}"></div></div><div class="form-actions"><button type="button" class="secondary" onclick="$('#modal').classList.add('hidden')">Cancel</button><button class="primary">Save Room</button></div></form>`}
async function openNewRooms(){modal("Add Room",roomForm());$("#roomForm").onsubmit=e=>saveRoom(e)}
async function saveRoom(e,id=null){e.preventDefault();const f=new FormData(e.target);await put("rooms",{id:id||uid(),name:f.get("name"),type:f.get("type"),beds:Number(f.get("beds"))});$("#modal").classList.add("hidden");toast("Room saved");renderRooms();renderDashboard()}
window.editRoom=async id=>{const r=(await all("rooms")).find(x=>x.id===id);modal("Edit Room",roomForm(r));$("#roomForm").onsubmit=e=>saveRoom(e,id)}
window.deleteRoom=async id=>{if(confirm("Delete this room?")){await del("rooms",id);renderRooms();renderDashboard()}};

async function renderPayments(){const ps=await all("payments"),gs=await all("guests");$("#paymentList").innerHTML=ps.length?`<table class="table"><thead><tr><th>Date</th><th>Guest</th><th>Type</th><th>Amount</th><th>Method</th><th>Reference</th><th></th></tr></thead><tbody>${ps.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<tr><td>${p.date}</td><td>${escapeHtml(gs.find(g=>g.id===p.guestId)?.name||"Unknown")}</td><td>${escapeHtml(p.type)}</td><td>${money(p.amount)}</td><td>${escapeHtml(p.method)}</td><td>${escapeHtml(p.reference||"-")}</td><td><button class="danger" onclick="deletePayment('${p.id}')">Delete</button></td></tr>`).join("")}</tbody></table>`:'<div class="empty">No payments recorded.</div>'}
function paymentForm(){return `<form id="paymentForm"><div class="form-grid"><div class="field full"><label>Guest *</label><select name="guestId" required id="paymentGuest"></select></div><div class="field"><label>Payment date *</label><input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Payment type</label><select name="type"><option>Monthly Rent</option><option>Advance / Deposit</option><option>Other</option></select></div><div class="field"><label>Amount *</label><input name="amount" type="number" min="0" step="0.01" required></div><div class="field"><label>Payment method</label><select name="method"><option>Cash</option><option>Bank Transfer</option><option>UPI</option><option>Card</option><option>Other</option></select></div><div class="field"><label>Reference / receipt no.</label><input name="reference"></div></div><div class="form-actions"><button type="button" class="secondary" onclick="$('#modal').classList.add('hidden')">Cancel</button><button class="primary">Save Payment</button></div></form>`}
async function openNewPayments(){modal("Record Payment",paymentForm());const gs=await all("guests");$("#paymentGuest").innerHTML='<option value="">Select guest</option>'+gs.map(g=>`<option value="${g.id}">${escapeHtml(g.name)} — ${escapeHtml(g.room||"")}</option>`).join("");$("#paymentForm").onsubmit=savePayment}
async function savePayment(e){e.preventDefault();const f=new FormData(e.target);await put("payments",{id:uid(),guestId:f.get("guestId"),date:f.get("date"),type:f.get("type"),amount:Number(f.get("amount")),method:f.get("method"),reference:f.get("reference")});$("#modal").classList.add("hidden");toast("Payment recorded");renderPayments();renderDashboard()}
window.deletePayment=async id=>{if(confirm("Delete this payment?")){await del("payments",id);renderPayments();renderDashboard()}};

$("#addGuestBtn").onclick=openNewGuests;$("#addRoomBtn").onclick=openNewRooms;$("#addPaymentBtn").onclick=openNewPayments;

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#installBtn").classList.remove("hidden")});
$("#installBtn").onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installBtn").classList.add("hidden")}};

if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
openDB().then(()=>renderDashboard());
