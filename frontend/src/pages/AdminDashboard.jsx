import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    image_url: ""
  });

  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await apiFetch("/api/products");
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  }

  // ==============================
  // UPLOAD DE IMAGEM
  // ==============================
  async function handleImageUpload() {
    if (!imageFile) return null;

    const formData = new FormData();
    formData.append("image", imageFile);

    const token = localStorage.getItem("token");

    const res = await fetch("http://localhost:4000/api/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!res.ok) {
      alert("Erro ao enviar imagem");
      return null;
    }

    const data = await res.json();
    return data.url; // URL retornada pelo backend
  }

  // ==============================
  // CRIAÇÃO DO PRODUTO
  // ==============================
  async function handleCreate(e) {
    e.preventDefault();

    // Se tiver imagem local → faz upload antes
    let finalImageUrl = form.image_url;

    if (imageFile) {
      const uploadedUrl = await handleImageUpload();
      if (uploadedUrl) finalImageUrl = uploadedUrl;
    }

    try {
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          image_url: finalImageUrl,
          price: parseFloat(form.price),
          stock: parseInt(form.stock || "0", 10)
        })
      });

      // Limpa formulário
      setForm({
        name: "",
        description: "",
        price: "",
        stock: "",
        image_url: ""
      });
      setImageFile(null);
      setPreview("");

      loadProducts();
    } catch (err) {
      alert("Erro ao criar produto (verifique se está logado como admin)");
    }
  }

  // ==============================
  // DELETAR PRODUTO
  // ==============================
  async function handleDelete(id) {
    if (!confirm("Deseja deletar?")) return;

    try {
      await apiFetch(`/api/products/${id}`, { method: "DELETE" });
      loadProducts();
    } catch (err) {
      alert("Erro ao deletar produto");
    }
  }

  // ==============================
  // NÃO É ADMIN
  // ==============================
  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-4">Painel Admin</h1>
        <p>Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Painel Admin</h1>

      <h2 className="text-xl font-semibold mb-2">Novo Produto</h2>
      <form onSubmit={handleCreate} className="grid gap-2 max-w-md mb-6">
        
        {/* Nome */}
        <input
          type="text"
          placeholder="Nome"
          className="border rounded px-3 py-2"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />

        {/* Descrição */}
        <textarea
          placeholder="Descrição"
          className="border rounded px-3 py-2"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        {/* Preço */}
        <input
          type="number"
          step="0.01"
          placeholder="Preço"
          className="border rounded px-3 py-2"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          required
        />

        {/* Estoque */}
        <input
          type="number"
          placeholder="Estoque"
          className="border rounded px-3 py-2"
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
          required
        />

        {/* IMAGEM URL (opcional) */}
        <input
          type="text"
          placeholder="URL da imagem (opcional se fizer upload)"
          className="border rounded px-3 py-2"
          value={form.image_url}
          onChange={(e) => setForm({ ...form, image_url: e.target.value })}
        />

        {/* UPLOAD LOCAL */}
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0];
              setImageFile(file);
              setPreview(URL.createObjectURL(file));
            }}
          />

          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="w-32 h-32 object-cover rounded border"
            />
          )}
        </div>

        {/* SUBMIT */}
        <button
          type="submit"
          className="bg-primary text-white px-4 py-2 rounded"
        >
          Salvar
        </button>
      </form>

      <h2 className="text-xl font-semibold mb-2">Produtos cadastrados</h2>
      <div className="grid gap-2">
        {products.map((p) => (
          <div
            key={p.id}
            className="flex justify-between items-center bg-white rounded px-3 py-2 shadow"
          >
            <div>
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-slate-500">
                R$ {p.price.toFixed(2)} | Estoque: {p.stock}
              </p>
            </div>

            <button
              onClick={() => handleDelete(p.id)}
              className="text-sm text-red-500"
            >
              Deletar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
