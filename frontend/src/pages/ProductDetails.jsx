import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useCart } from "../context/CartContext";

export default function ProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    apiFetch(`/api/products/${id}`)
      .then(setProduct)
      .catch((e) => console.error(e));
  }, [id]);

  if (!product) {
    return (
      <div className="max-w-5xl mx-auto px-4">
        Carregando...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 flex flex-col md:flex-row gap-4">
      <img
        src={product.image_url}
        alt={product.name}
        className="w-full md:w-1/2 rounded"
      />
      <div>
        <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
        <p className="mb-2">{product.description}</p>
        <p className="font-bold text-primary text-xl mb-4">
          R$ {product.price.toFixed(2)}
        </p>
        <button
          onClick={() => addToCart(product)}
          className="bg-primary text-white px-4 py-2 rounded"
        >
          Adicionar ao carrinho
        </button>
      </div>
    </div>
  );
}
