import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import ProductCard from "../components/ProductCard";

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    apiFetch("/api/products")
      .then(setProducts)
      .catch((e) => console.error(e));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Produtos</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
