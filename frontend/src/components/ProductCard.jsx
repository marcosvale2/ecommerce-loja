import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  return (
    <div className="bg-white rounded-lg shadow p-3 flex flex-col">
      <img
        src={product.image_url}
        alt={product.name}
        className="w-full h-40 object-cover rounded"
      />
      <h3 className="mt-2 font-semibold">{product.name}</h3>
      <p className="text-sm text-slate-500 line-clamp-2">
        {product.description}
      </p>
      <p className="mt-1 font-bold text-primary">
        R$ {product.price.toFixed(2)}
      </p>
      <div className="mt-auto flex gap-2">
        <button
          onClick={() => addToCart(product)}
          className="flex-1 mt-2 bg-primary text-white py-1 rounded text-sm"
        >
          Adicionar
        </button>
        <Link
          to={`/product/${product.id}`}
          className="mt-2 text-sm text-primary underline"
        >
          Detalhes
        </Link>
      </div>
    </div>
  );
}
