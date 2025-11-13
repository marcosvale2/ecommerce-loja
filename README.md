# E-commerce do Zero

Projeto base de e-commerce com:

- Backend em **Node.js + Express + SQLite + JWT**
- Frontend em **React + Vite + TailwindCSS**
- Painel admin simples para cadastro de produtos
- Carrinho, checkout e criação de pedidos (simulação)

## Como rodar

### 1. Backend

```bash
cd backend
cp .env.example .env   # edite se quiser
npm install
npm run dev
```

O backend ficará em: `http://localhost:4000`

Usuário admin padrão:

- **E-mail:** admin@loja.com  
- **Senha:** admin123

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend abrirá em algo como: `http://localhost:5173`

Depois é só adaptar para o nicho da loja (roupa, mercado, etc.) e subir para GitHub / Vercel / Railway.
