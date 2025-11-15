const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const db = require("./db"); // <<< AGORA USA POSTGRES

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
    const uniqueName = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ====================== AUTH MIDDLEWARE ======================
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

// ====================== LOGIN ======================
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
  const user = result.rows[0];

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
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  try {
    const result = await db.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'customer') RETURNING id",
      [name, email, hash]
    );

    res.status(201).json({ id: result.rows[0].id, name, email });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: "Erro ao cadastrar" });
  }
});

// ====================== PRODUTOS ======================
app.get("/api/products", async (req, res) => {
  const result = await db.query("SELECT * FROM products ORDER BY id DESC");
  res.json(result.rows);
});

app.post("/api/products", authMiddleware, adminMiddleware, async (req, res) => {
  const { name, description, price, stock, image_url } = req.body;

  const result = await db.query(
    "INSERT INTO products (name, description, price, stock, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [name, description, price, stock, image_url]
  );

  res.status(201).json({ id: result.rows[0].id });
});

// ====================== DELETAR PRODUTO ======================
app.delete("/api/products/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;

  const result = await db.query("DELETE FROM products WHERE id = $1 RETURNING id", [id]);

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Produto não encontrado" });
  }

  res.json({ message: "Produto deletado com sucesso" });
});

// ====================== PEDIDOS ======================
app.post("/api/orders", authMiddleware, async (req, res) => {
  const { items, total_price } = req.body;

  if (!items || items.length === 0)
    return res.status(400).json({ message: "Carrinho vazio" });

  const today = new Date().toISOString().slice(0, 10);

  const countResult = await db.query(
    "SELECT COUNT(*) AS count FROM orders WHERE order_date = $1",
    [today]
  );

  const displayNumber = Number(countResult.rows[0].count) + 1;

  const orderResult = await db.query(
    "INSERT INTO orders (user_id, total_price, display_number, order_date) VALUES ($1, $2, $3, $4) RETURNING id",
    [req.user.id, total_price, displayNumber, today]
  );

  const orderId = orderResult.rows[0].id;

  for (const item of items) {
    await db.query(
      "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)",
      [orderId, item.product_id, item.quantity, item.unit_price]
    );
  }

  res.json({
    message: "Pedido criado",
    order_id: orderId,
    display_number: displayNumber,
  });
});

// ====================== LISTAR PEDIDOS COMPLETOS ======================
app.get("/api/orders/full", authMiddleware, adminMiddleware, async (req, res) => {
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

  const result = await db.query(sql);
  const rows = result.rows;

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

// ====================== DELETE PEDIDO ======================
app.delete("/api/orders/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;

  await db.query("DELETE FROM order_items WHERE order_id = $1", [id]);
  const result = await db.query("DELETE FROM orders WHERE id = $1 RETURNING id", [id]);

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Pedido não encontrado" });
  }

  res.json({ message: "Pedido excluído com sucesso" });
});

// ====================== CONFIRMAR PAGAMENTO ======================
app.post("/api/orders/:display_number/pay", authMiddleware, async (req, res) => {
  const displayNumber = req.params.display_number;
  const today = new Date().toISOString().slice(0, 10);

  const result = await db.query(
    "UPDATE orders SET status = 'paid' WHERE display_number = $1 AND order_date = $2 RETURNING id",
    [displayNumber, today]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Pedido não encontrado para hoje." });
  }

  res.json({ message: "Pagamento confirmado!" });
});

// ====================== START ======================
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
