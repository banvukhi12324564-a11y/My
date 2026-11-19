require("dotenv").config?.();

const express = require("express");
const session = require("express-session");
const SQLiteStoreFactory = require("connect-sqlite3");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("Set SESSION_SECRET to a random string of at least 32 characters.");
  process.exit(1);
}
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in your environment.");
  process.exit(1);
}

const db = new Database(path.join(dataDir, "shop.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Vũ khí',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK(price >= 0),
  game_item_key TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Chờ xử lý',
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  admin_id INTEGER REFERENCES users(id),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
const adminExists = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (!adminExists) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
  db.prepare("INSERT INTO users (username,email,password_hash,role) VALUES (?,?,?,'admin')")
    .run("Admin", adminEmail, hash);
}

const SQLiteStore = SQLiteStoreFactory(session);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "strict", secure: isProduction, maxAge: 1000 * 60 * 60 * 8 }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
const money = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000000;
const clean = (v, max=300) => String(v ?? "").trim().slice(0, max);
const publicUser = u => ({ id:u.id, username:u.username, email:u.email, role:u.role, balance:u.balance });

function requireAuth(req,res,next) {
  const user = req.session.userId && db.prepare("SELECT * FROM users WHERE id=?").get(req.session.userId);
  if (!user) return res.status(401).json({ error:"Vui lòng đăng nhập." });
  req.user = user; next();
}
function requireAdmin(req,res,next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error:"Bạn không có quyền Admin." });
  next();
}
function fail(res, message, status=400) { return res.status(status).json({ error:message }); }

app.get("/api/me", (req,res) => {
  const u = req.session.userId && db.prepare("SELECT * FROM users WHERE id=?").get(req.session.userId);
  res.json({ user: u ? publicUser(u) : null });
});

app.post("/api/register", authLimiter, (req,res) => {
  const username = clean(req.body.username, 24);
  const email = clean(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || "");
  if (!/^[\p{L}\p{N}_]{3,24}$/u.test(username)) return fail(res,"Tên tài khoản cần 3–24 ký tự, chỉ gồm chữ, số hoặc _.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res,"Email không hợp lệ.");
  if (password.length < 10 || password.length > 100) return fail(res,"Mật khẩu cần ít nhất 10 ký tự.");
  try {
    const hash = bcrypt.hashSync(password, 12);
    const info = db.prepare("INSERT INTO users (username,email,password_hash) VALUES (?,?,?)").run(username,email,hash);
    req.session.userId = Number(info.lastInsertRowid);
    res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid)) });
  } catch { fail(res,"Tên tài khoản hoặc email đã được sử dụng."); }
});

app.post("/api/login", authLimiter, (req,res) => {
  const login = clean(req.body.login,120);
  const user = db.prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE OR email=? COLLATE NOCASE").get(login,login);
  if (!user || !bcrypt.compareSync(String(req.body.password || ""), user.password_hash)) return fail(res,"Thông tin đăng nhập không đúng.",401);
  req.session.regenerate(err => {
    if (err) return fail(res,"Không thể tạo phiên đăng nhập.",500);
    req.session.userId = user.id;
    res.json({ user:publicUser(user) });
  });
});
app.post("/api/logout", (req,res) => req.session.destroy(() => res.json({ ok:true })));

app.get("/api/products", (req,res) => {
  const products = db.prepare("SELECT id,name,category,description,image_url,price,game_item_key FROM products WHERE active=1 ORDER BY id DESC").all();
  res.json({ products });
});
app.get("/api/orders", requireAuth, (req,res) => {
  const orders = db.prepare("SELECT id,total,status,items_json,created_at FROM orders WHERE user_id=? ORDER BY id DESC").all(req.user.id)
    .map(o => ({...o, items:JSON.parse(o.items_json)}));
  res.json({ orders });
});
app.get("/api/transactions", requireAuth, (req,res) => {
  res.json({ transactions:db.prepare("SELECT id,amount,balance_after,type,note,created_at FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT 100").all(req.user.id) });
});

// Demo wallet only: these internal credits are not cash, deposits, or a payment rail.
app.post("/api/checkout", requireAuth, (req,res) => {
  const ids = Array.isArray(req.body.productIds) ? req.body.productIds.slice(0,20) : [];
  if (!ids.length || ids.some(id => !Number.isInteger(Number(id)))) return fail(res,"Giỏ hàng không hợp lệ.");
  const uniqueIds = [...new Set(ids.map(Number))];
  const products = uniqueIds.map(id => db.prepare("SELECT id,name,price,game_item_key FROM products WHERE id=? AND active=1").get(id)).filter(Boolean);
  if (products.length !== uniqueIds.length) return fail(res,"Có sản phẩm không còn khả dụng.");
  const total = products.reduce((sum,p) => sum + p.price,0);
  const transaction = db.transaction(() => {
    const user = db.prepare("SELECT balance FROM users WHERE id=?").get(req.user.id);
    if (user.balance < total) throw new Error("Số dư thử nghiệm không đủ.");
    const after = user.balance - total;
    db.prepare("UPDATE users SET balance=? WHERE id=?").run(after,req.user.id);
    const info = db.prepare("INSERT INTO orders (user_id,total,items_json) VALUES (?,?,?)")
      .run(req.user.id,total,JSON.stringify(products.map(p=>({id:p.id,name:p.name,price:p.price,itemKey:p.game_item_key}))));
    db.prepare("INSERT INTO transactions (user_id,amount,balance_after,type,note) VALUES (?,?,?,?,?)")
      .run(req.user.id,-total,after,"purchase",`Đơn hàng #${info.lastInsertRowid}`);
    return Number(info.lastInsertRowid);
  });
  try { const orderId = transaction(); res.json({ ok:true, orderId }); }
  catch(e) { fail(res,e.message); }
});

app.get("/api/admin/summary", requireAuth, requireAdmin, (req,res) => {
  res.json({
    users:db.prepare("SELECT id,username,email,role,balance,created_at FROM users ORDER BY id DESC LIMIT 200").all(),
    products:db.prepare("SELECT * FROM products ORDER BY id DESC").all(),
    orders:db.prepare("SELECT o.id,o.total,o.status,o.created_at,u.username FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 100").all()
  });
});
app.post("/api/admin/products", requireAuth, requireAdmin, (req,res) => {
  const id = Number(req.body.id || 0);
  const name = clean(req.body.name,80), category = clean(req.body.category || "Vũ khí",40);
  const description = clean(req.body.description,500), image_url = clean(req.body.image_url,500);
  const game_item_key = clean(req.body.game_item_key,100);
  const price = Number(req.body.price);
  if (!name || !money(price)) return fail(res,"Tên sản phẩm hoặc giá không hợp lệ.");
  if (image_url && !/^https:\/\/.+/i.test(image_url)) return fail(res,"Ảnh cần là đường dẫn HTTPS.");
  if (id) db.prepare("UPDATE products SET name=?,category=?,description=?,image_url=?,price=?,game_item_key=?,active=? WHERE id=?")
    .run(name,category,description,image_url,price,game_item_key,req.body.active===false?0:1,id);
  else db.prepare("INSERT INTO products (name,category,description,image_url,price,game_item_key) VALUES (?,?,?,?,?,?)")
    .run(name,category,description,image_url,price,game_item_key);
  res.json({ok:true});
});
app.delete("/api/admin/products/:id", requireAuth, requireAdmin, (req,res) => {
  db.prepare("UPDATE products SET active=0 WHERE id=?").run(Number(req.params.id));
  res.json({ok:true});
});
app.post("/api/admin/wallet", requireAuth, requireAdmin, (req,res) => {
  const userId = Number(req.body.userId), amount = Number(req.body.amount);
  const note = clean(req.body.note,200);
  const action = req.body.action;
  if (!Number.isInteger(userId) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000) return fail(res,"Số tiền hoặc tài khoản không hợp lệ.");
  if (!["credit","debit"].includes(action)) return fail(res,"Loại điều chỉnh không hợp lệ.");
  const tx = db.transaction(() => {
    const target = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
    if (!target) throw new Error("Không tìm thấy tài khoản.");
    const delta = action === "credit" ? amount : -amount;
    const after = target.balance + delta;
    if (after < 0) throw new Error("Số dư không thể âm.");
    db.prepare("UPDATE users SET balance=? WHERE id=?").run(after,userId);
    db.prepare("INSERT INTO transactions (user_id,admin_id,amount,balance_after,type,note) VALUES (?,?,?,?,?,?)")
      .run(userId,req.user.id,delta,after,action==="credit"?"admin_credit":"admin_debit",note || "Admin điều chỉnh số dư thử nghiệm");
  });
  try { tx(); res.json({ok:true}); } catch(e) { fail(res,e.message); }
});
app.post("/api/admin/orders/:id/status", requireAuth, requireAdmin, (req,res) => {
  const status = clean(req.body.status,30);
  if (!["Chờ xử lý","Đang xử lý","Hoàn tất","Đã hủy"].includes(status)) return fail(res,"Trạng thái không hợp lệ.");
  db.prepare("UPDATE orders SET status=? WHERE id=?").run(status,Number(req.params.id));
  res.json({ok:true});
});

app.use(express.static(path.join(__dirname,"public")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Vietnam Warrior Shop running on port ${PORT}`));
