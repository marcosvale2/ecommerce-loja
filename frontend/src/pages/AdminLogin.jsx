import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState("admin@loja.com");
  const [password, setPassword] = useState("admin123");
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      alert("Erro ao fazer login");
    }
  }

  return (
    <div className="max-w-md mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <form onSubmit={handleSubmit} className="grid gap-3">
        <input
          type="email"
          placeholder="E-mail"
          className="border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Senha"
          className="border rounded px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          className="bg-primary text-white px-4 py-2 rounded"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
