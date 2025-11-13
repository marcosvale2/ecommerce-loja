import { useCart } from "../context/CartContext";
import { Link, useNavigate } from "react-router-dom";

export default function CartPage() {
  const { items, removeFromCart, total } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-4">Carrinho</h1>
        <p>Seu carrinho está vazio.</p>
        <Link to="/" className="text-primary underline">
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Carrinho</h1>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex justify-between items-center border-b py-2"
        >
          <div>
            <p className="font-semibold">{item.name}</p>
            <p className="text-sm text-slate-500">
              {item.quantity} x R$ {item.price.toFixed(2)}
            </p>
          </div>
          <button
            onClick={() => removeFromCart(item.id)}
            className="text-sm text-red-500"
          >
            Remover
          </button>
        </div>
      ))}
      <p className="mt-4 font-bold text-xl">
        Total: R$ {total.toFixed(2)}
      </p>
      <button
        onClick={() => navigate("/checkout")}
        className="mt-4 bg-primary text-white px-4 py-2 rounded"
      >
        Finalizar compra
      </button>
    </div>
  );
}
