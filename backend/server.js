const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");

dotenv.config();

const app = express();
app.use(
  cors({
    origin: "*",
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",
  })
);

app.use(express.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "secret";

// ====================== ARQUIVOS ESTÁTICOS ======================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ====================== MULTER ======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ====================== BANCO DE DADOS ======================
const db = new Database("./database2.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer'
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total_price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    display_number INTEGER,
    order_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// Criar admin padrão
const adminExists = db
  .prepare("SELECT * FROM users WHERE email = ?")
  .get("admin@loja.com");

if (!adminExists) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
  ).run("Admin", "admin@loja.com", hash, "admin");

  console.log("Admin criado: admin@loja.com / admin123");
}

// ====================== MIDDLEWARE AUTH ======================
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "Token não enviado" });

  const token = header.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Token inválido" });
    req.user = decoded;
    next();
  });
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Apenas admin pode acessar" });
  }
  next();
}

// ====================== UPLOAD DE IMAGEM ======================
app.post(
  "/api/upload",
  authMiddleware,
  adminMiddleware,
  upload.single("image"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }

    // Usa host real da requisição — Render ou Local
    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
  }
);

// ====================== LOGIN ======================
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) return res.status(400).json({ message: "Usuário não encontrado" });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(400).json({ message: "Senha incorreta" });

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// ====================== REGISTRO ======================
app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  try {
    const stmt = db.prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')"
    );

    const result = stmt.run(name, email, hash);
    res.status(201).json({ id: result.lastInsertRowid, name, email });
  } catch (err) {
    return res.status(400).json({ message: "Erro ao cadastrar" });
  }
});

// ====================== PRODUTOS ======================
app.get("/api/products", (req, res) => {
  const products = db.prepare("SELECT * FROM products").all();
  res.json(products);
});

app.post("/api/products", authMiddleware, adminMiddleware, (req, res) => {
  const { name, description, price, stock, image_url } = req.body;

  const stmt = db.prepare(
    "INSERT INTO products (name, description, price, stock, image_url) VALUES (?, ?, ?, ?, ?)"
  );

  const result = stmt.run(name, description, price, stock, image_url);
  res.status(201).json({ id: result.lastInsertRowid });
});

// ====================== DELETAR PRODUTO (CORRIGIDO) ======================
app.delete("/api/products/:id", authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare("DELETE FROM products WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Produto não encontrado" });
    }

    return res.json({ message: "Produto deletado com sucesso" });
  } catch (err) {
    console.error("Erro ao deletar produto:", err);
    return res.status(500).json({ message: "Erro ao deletar produto" });
  }
});

// ====================== PEDIDOS ======================
app.post("/api/orders", authMiddleware, (req, res) => {
  const { items, total_price } = req.body;

  if (!items || items.length === 0)
    return res.status(400).json({ message: "Carrinho vazio" });

  const today = new Date().toISOString().slice(0, 10);

  const count = db
    .prepare("SELECT COUNT(*) AS count FROM orders WHERE order_date = ?")
    .get(today).count;

  const displayNumber = count + 1;

  const orderResult = db
    .prepare(
      "INSERT INTO orders (user_id, total_price, display_number, order_date) VALUES (?, ?, ?, ?)"
    )
    .run(req.user.id, total_price, displayNumber, today);

  const orderId = orderResult.lastInsertRowid;

  const stmt = db.prepare(
    "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)"
  );

  items.forEach((item) => {
    stmt.run(orderId, item.product_id, item.quantity, item.unit_price);
  });

  res.json({
    message: "Pedido criado",
    order_id: orderId,
    display_number: displayNumber,
  });
});

// ====================== ADMIN - LISTAR TODOS OS PEDIDOS COMPLETOS ======================
app.get("/api/orders/full", authMiddleware, adminMiddleware, (req, res) => {
  const sql = `
    SELECT 
      o.id AS order_id,
      o.display_number,
      o.order_date,
      o.total_price,
      o.status,
      o.created_at,
      u.id AS user_id,
      u.name AS user_name,
      u.email AS user_email,
      oi.product_id,
      oi.quantity,
      oi.unit_price,
      p.name AS product_name
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    ORDER BY o.created_at DESC
  `;

  const rows = db.prepare(sql).all();

  const grouped = {};

  rows.forEach((r) => {
    if (!grouped[r.order_id]) {
      grouped[r.order_id] = {
        order_id: r.order_id,
        display_number: r.display_number,
        order_date: r.order_date,
        total_price: r.total_price,
        status: r.status,
        created_at: r.created_at,
        user: {
          id: r.user_id,
          name: r.user_name,
          email: r.user_email,
        },
        items: []
      };
    }

    grouped[r.order_id].items.push({
      product_id: r.product_id,
      product_name: r.product_name,
      quantity: r.quantity,
      unit_price: r.unit_price
    });
  });

  res.json(Object.values(grouped));
});

// ====================== DELETE PEDIDO (CORRIGIDO) ======================
app.delete("/api/orders/:id", authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;

  try {
    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(id);
    const result = db.prepare("DELETE FROM orders WHERE id = ?").run(id);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Pedido não encontrado" });
    }

    return res.json({ message: "Pedido excluído com sucesso" });
  } catch (err) {
    console.error("Erro ao deletar pedido:", err);
    return res.status(500).json({ message: "Erro ao deletar pedido" });
  }
});

// ====================== CONFIRMAR PAGAMENTO ======================
app.post("/api/orders/:display_number/pay", authMiddleware, (req, res) => {
  const displayNumber = req.params.display_number;
  const today = new Date().toISOString().slice(0, 10);

  const result = db
    .prepare(
      `
    UPDATE orders 
    SET status = 'paid' 
    WHERE display_number = ? AND order_date = ?
    `
    )
    .run(displayNumber, today);

  if (result.changes === 0) {
    return res
      .status(404)
      .json({ message: "Pedido não encontrado para hoje." });
  }

  res.json({ message: "Pagamento confirmado!" });
});

// ====================== START ======================
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
