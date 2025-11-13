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
app.use(cors());
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
const db = new Database("./database.sqlite");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // ATUALIZADA: agora tem display_number e order_date
  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      total_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      display_number INTEGER,
      order_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // ADMIN PADRÃO
  db.get(
    "SELECT * FROM users WHERE email = ?",
    ["admin@loja.com"],
    (err, row) => {
      if (!row) {
        const hash = bcrypt.hashSync("admin123", 10);
        db.run(
          "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
          ["Admin", "admin@loja.com", hash, "admin"]
        );
        console.log("Admin criado: admin@loja.com / admin123");
      }
    }
  );
});

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

    const imageUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
  }
);

// ====================== LOGIN ======================
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
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
});

// ====================== REGISTRO ======================
app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  db.run(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')",
    [name, email, hash],
    function (err) {
      if (err) return res.status(400).json({ message: "Erro ao cadastrar" });
      res.status(201).json({ id: this.lastID, name, email });
    }
  );
});

// ====================== PRODUTOS ======================
app.get("/api/products", (req, res) => {
  db.all("SELECT * FROM products", (err, rows) => {
    if (err) return res.status(500).json({ message: "Erro ao listar produtos" });
    res.json(rows);
  });
});

app.post("/api/products", authMiddleware, adminMiddleware, (req, res) => {
  const { name, description, price, stock, image_url } = req.body;

  db.run(
    "INSERT INTO products (name, description, price, stock, image_url) VALUES (?, ?, ?, ?, ?)",
    [name, description, price, stock, image_url],
    function (err) {
      if (err) return res.status(400).json({ message: "Erro ao criar produto" });
      res.status(201).json({ id: this.lastID });
    }
  );
});

// ====================== >>> PEDIDOS (ALTERADO) <<< ======================

// Criar pedido com display_number
app.post("/api/orders", authMiddleware, (req, res) => {
  const { items, total_price } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Carrinho vazio" });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 1) Contar pedidos do dia atual
  db.get(
    "SELECT COUNT(*) AS count FROM orders WHERE order_date = ?",
    [today],
    (err, row) => {
      if (err) return res.status(500).json({ message: "Erro interno" });

      const nextDisplayNumber = row.count + 1;

      // 2) Criar pedido com display_number
      db.run(
        "INSERT INTO orders (user_id, total_price, display_number, order_date) VALUES (?, ?, ?, ?)",
        [req.user.id, total_price, nextDisplayNumber, today],
        function (err2) {
          if (err2)
            return res.status(400).json({ message: "Erro ao criar pedido" });

          const orderId = this.lastID;

          // 3) Inserir itens
          const stmt = db.prepare(
            "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)"
          );
          items.forEach((item) => {
            stmt.run(orderId, item.product_id, item.quantity, item.unit_price);
          });
          stmt.finalize();

          // 4) Retornar display_number
          res.json({
            message: "Pedido criado",
            order_id: orderId,
            display_number: nextDisplayNumber,
          });
        }
      );
    }
  );
});

// ====================== LISTAR PEDIDOS ======================
app.get("/api/orders/my", authMiddleware, (req, res) => {
  db.all("SELECT * FROM orders WHERE user_id = ?", [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: "Erro ao listar pedidos" });
    res.json(rows);
  });
});

// ADMIN - listar pedidos completos
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

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: "Erro ao listar pedidos" });

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
          items: [],
        };
      }

      grouped[r.order_id].items.push({
        product_id: r.product_id,
        product_name: r.product_name,
        quantity: r.quantity,
        unit_price: r.unit_price,
      });
    });

    res.json(Object.values(grouped));
  });
});

// ====================== DELETAR PEDIDO ======================
app.delete("/api/orders/:id", authMiddleware, adminMiddleware, (req, res) => {
  const orderId = req.params.id;

  db.run("DELETE FROM order_items WHERE order_id = ?", [orderId], (err1) => {
    if (err1) return res.status(500).json({ message: "Erro ao deletar itens" });

    db.run("DELETE FROM orders WHERE id = ?", [orderId], (err2) => {
      if (err2) return res.status(500).json({ message: "Erro ao deletar pedido" });

      res.json({ message: "Pedido excluído com sucesso" });
    });
  });
});

// ====================== CONFIRMAR PAGAMENTO (cliente) ======================
app.post("/api/orders/:display_number/pay", authMiddleware, (req, res) => {
  const displayNumber = req.params.display_number;

  // Atualiza o pedido usando DISPLAY_NUMBER + DATA DO PEDIDO (garante unicidade)
  const today = new Date().toISOString().slice(0, 10);

  db.run(
    `
    UPDATE orders 
    SET status = 'paid' 
    WHERE display_number = ? AND order_date = ?
    `,
    [displayNumber, today],
    function (err) {
      if (err) {
        console.error("Erro ao atualizar status:", err);
        return res.status(500).json({ message: "Erro ao confirmar pagamento." });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          message: "Pedido não encontrado para hoje."
        });
      }

      res.json({ message: "Pagamento confirmado!" });
    }
  );
});




// ====================== START ======================
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
