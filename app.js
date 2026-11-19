const $ = s => document.querySelector(s);
let me = null, products = [], cart = [];
const money = n => new Intl.NumberFormat("vi-VN").format(n) + " xu";
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(url, options={}) {
  const res = await fetch(url,{headers:{"Content-Type":"application/json"},...options});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || "Có lỗi xảy ra.");
  return data;
}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function modal(html){$("#modalBody").innerHTML=html;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
$("#closeModal").onclick=closeModal;$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
function updateHeader(){$("#accountBtn").textContent=me?`${me.username} · ${money(me.balance)}`:"Tài khoản";$("#cartCount").textContent=cart.length}
async function loadProducts(){
  const d=await api("/api/products");products=d.products;renderProducts(products);
}
function renderProducts(list){
  $("#products").innerHTML=list.length?list.map(p=>`<article class="product">
    <div class="product-image">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()">`:"⚔"}</div>
    <div class="product-info"><small>${esc(p.category)}</small><h3>${esc(p.name)}</h3><p>${esc(p.description||"Vật phẩm trong bộ sưu tập cộng đồng.")}</p>
    <div class="product-bottom"><span class="price">${money(p.price)}</span><button class="buy-btn" data-add="${p.id}">THÊM VÀO GIỎ</button></div></div></article>`).join(""):`<div class="empty">Chưa có sản phẩm. Admin có thể thêm sản phẩm trong bảng quản trị.</div>`;
  document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{cart.push(Number(b.dataset.add));updateHeader();toast("Đã thêm vào giỏ hàng.")});
}
$("#search").oninput=e=>renderProducts(products.filter(p=>(p.name+" "+p.category+" "+p.description).toLowerCase().includes(e.target.value.toLowerCase())));
async function refreshMe(){const d=await api("/api/me");me=d.user;updateHeader()}
$("#accountBtn").onclick=showAccount;
function showAccount(){
 if(!me){modal(`<h2>WELCOME, WARRIOR</h2><p class="muted">Đăng nhập hoặc tạo tài khoản cộng đồng.</p><div class="tabs"><button class="active" id="loginTab">Đăng nhập</button><button id="registerTab">Đăng ký</button></div><div id="authForm"></div>`);authForm("login");$("#loginTab").onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));$("#loginTab").classList.add("active");authForm("login")};$("#registerTab").onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));$("#registerTab").classList.add("active");authForm("register")};return}
 modal(`<h2>WARRIOR PROFILE</h2><p class="muted">Xin chào, ${esc(me.username)}.</p><div class="admin-box"><small class="muted">SỐ DƯ DEMO</small><h2 style="color:var(--gold)">${money(me.balance)}</h2><p class="muted">Số dư thử nghiệm nội bộ, không phải tiền thật và không thể rút/chuyển đổi.</p></div><div class="tabs"><button id="ordersTab">Đơn hàng</button><button id="historyTab">Lịch sử ví</button>${me.role==="admin"?'<button id="adminTab">Quản trị</button>':""}</div><div id="accountContent"></div><button id="logout" class="wide">ĐĂNG XUẤT</button>`);
 $("#ordersTab").onclick=showOrders;$("#historyTab").onclick=showHistory;if(me.role==="admin")$("#adminTab").onclick=showAdmin;$("#logout").onclick=async()=>{await api("/api/logout",{method:"POST"});me=null;updateHeader();closeModal();toast("Đã đăng xuất.")};showOrders();
}
function authForm(type){$("#authForm").innerHTML=type==="login"?`<form id="auth"><div class="field"><label>TÊN TÀI KHOẢN HOẶC EMAIL</label><input name="login" required></div><div class="field"><label>MẬT KHẨU</label><input name="password" type="password" required></div><button class="gold-btn wide">ĐĂNG NHẬP</button></form>`:`<form id="auth"><div class="field"><label>TÊN TÀI KHOẢN</label><input name="username" required minlength="3" maxlength="24"></div><div class="field"><label>EMAIL</label><input name="email" type="email" required></div><div class="field"><label>MẬT KHẨU (TỐI THIỂU 10 KÝ TỰ)</label><input name="password" type="password" minlength="10" required></div><button class="gold-btn wide">TẠO TÀI KHOẢN</button></form>`;$("#auth").onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));try{const d=await api(type==="login"?"/api/login":"/api/register",{method:"POST",body:JSON.stringify(body)});me=d.user;updateHeader();showAccount();toast("Đăng nhập thành công.")}catch(err){toast(err.message)}}}
async function showOrders(){try{const d=await api("/api/orders");$("#accountContent").innerHTML=`<div class="data-list">${d.orders.length?d.orders.map(o=>`<div class="data-row"><span>Đơn #${o.id}<small>${new Date(o.created_at+"Z").toLocaleString("vi-VN")} · ${o.items.map(i=>esc(i.name)).join(", ")}</small></span><span>${money(o.total)}<small>${esc(o.status)}</small></span></div>`).join(""):"<p class='muted'>Bạn chưa có đơn hàng.</p>"}</div>`}catch(e){toast(e.message)}}
async function showHistory(){try{const d=await api("/api/transactions");$("#accountContent").innerHTML=`<div class="data-list">${d.transactions.length?d.transactions.map(t=>`<div class="data-row"><span>${esc(t.type)}<small>${esc(t.note)} · ${new Date(t.created_at+"Z").toLocaleString("vi-VN")}</small></span><span>${t.amount>0?"+":""}${money(t.amount)}<small>Còn ${money(t.balance_after)}</small></span></div>`).join(""):"<p class='muted'>Chưa có giao dịch.</p>"}</div>`}catch(e){toast(e.message)}}
async function showAdmin(){
 try{const d=await api("/api/admin/summary");$("#accountContent").innerHTML=`
 <div class="admin-box"><h3>THÊM SẢN PHẨM</h3><form id="productForm"><div class="field"><label>TÊN SẢN PHẨM</label><input name="name" required></div><div class="form-row"><div class="field"><label>PHÂN LOẠI</label><input name="category" value="Vũ khí"></div><div class="field"><label>GIÁ (XU DEMO)</label><input name="price" type="number" min="0" required></div></div><div class="field"><label>LINK ẢNH HTTPS</label><input name="image_url" placeholder="https://..."></div><div class="field"><label>MÔ TẢ</label><textarea name="description"></textarea></div><div class="field"><label>MÃ TÍCH HỢP GAME (TÙY CHỌN)</label><input name="game_item_key" placeholder="VD: ITEM_SWORD_01"></div><button class="gold-btn wide">THÊM SẢN PHẨM</button></form></div>
 <div class="admin-box"><h3>ĐIỀU CHỈNH VÍ DEMO</h3><form id="walletForm"><div class="field"><label>TÀI KHOẢN</label><select name="userId">${d.users.map(u=>`<option value="${u.id}">${esc(u.username)} · ${money(u.balance)}</option>`).join("")}</select></div><div class="form-row"><div class="field"><label>THAO TÁC</label><select name="action"><option value="credit">Cộng xu demo</option><option value="debit">Trừ xu demo</option></select></div><div class="field"><label>SỐ LƯỢNG</label><input name="amount" type="number" min="1" required></div></div><div class="field"><label>LÝ DO</label><input name="note" maxlength="200" required></div><button class="gold-btn wide">XÁC NHẬN ĐIỀU CHỈNH</button></form></div>
 <div class="admin-box"><h3>SẢN PHẨM HIỆN CÓ</h3><div class="data-list">${d.products.map(p=>`<div class="data-row"><span>${esc(p.name)}<small>${money(p.price)} · ${p.active?"Đang hiển thị":"Đã ẩn"}</small></span><button class="buy-btn" data-del="${p.id}">ẨN</button></div>`).join("")||"<p class='muted'>Chưa có sản phẩm.</p>"}</div></div>
 <div class="admin-box"><h3>ĐƠN HÀNG GẦN ĐÂY</h3><div class="data-list">${d.orders.map(o=>`<div class="data-row"><span>#${o.id} · ${esc(o.username)}<small>${money(o.total)} · ${esc(o.created_at)}</small></span><select data-status="${o.id}">${["Chờ xử lý","Đang xử lý","Hoàn tất","Đã hủy"].map(s=>`<option ${s===o.status?"selected":""}>${s}</option>`).join("")}</select></div>`).join("")||"<p class='muted'>Chưa có đơn hàng.</p>"}</div></div>
 <p class="muted">Chỉ điều chỉnh số dư demo. Không có chức năng nạp tiền thật, xử lý thẻ cào hoặc rút tiền.</p>`;
 $("#productForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/admin/products",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});await loadProducts();showAdmin();toast("Đã thêm sản phẩm.")}catch(x){toast(x.message)}};
 $("#walletForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/admin/wallet",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});await refreshMe();showAdmin();toast("Đã cập nhật ví demo.")}catch(x){toast(x.message)}};
 document.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!confirm("Ẩn sản phẩm này?"))return;await api("/api/admin/products/"+b.dataset.del,{method:"DELETE"});await loadProducts();showAdmin()});
 document.querySelectorAll("[data-status]").forEach(s=>s.onchange=async()=>{await api("/api/admin/orders/"+s.dataset.status+"/status",{method:"POST",body:JSON.stringify({status:s.value})});toast("Đã cập nhật trạng thái.")});
 }catch(e){toast(e.message)}
}
$("#cartBtn").onclick=async()=>{
 if(!cart.length){toast("Giỏ hàng đang trống.");return}
 if(!me){toast("Đăng nhập trước khi tạo đơn.");showAccount();return}
 const selected=cart.map(id=>products.find(p=>p.id===id)).filter(Boolean);
 modal(`<h2>YOUR CART</h2><div class="data-list">${selected.map(p=>`<div class="data-row"><span>${esc(p.name)}</span><b>${money(p.price)}</b></div>`).join("")}</div><div class="data-row"><b>TỔNG CỘNG</b><b class="price">${money(selected.reduce((a,p)=>a+p.price,0))}</b></div><p class="muted">Đây là đơn hàng thử nghiệm dùng xu demo, không phải thanh toán thật.</p><button id="checkout" class="gold-btn wide">TẠO ĐƠN HÀNG</button>`);
 $("#checkout").onclick=async()=>{try{const d=await api("/api/checkout",{method:"POST",body:JSON.stringify({productIds:cart})});cart=[];await refreshMe();updateHeader();closeModal();toast("Đã tạo đơn #"+d.orderId);showAccount()}catch(e){toast(e.message)}};
};
(async()=>{try{await refreshMe();await loadProducts()}catch(e){toast(e.message)}})();
