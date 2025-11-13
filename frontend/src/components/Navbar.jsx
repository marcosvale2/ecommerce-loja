import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { items } = useCart();
  const { user, logout, isAdmin } = useAuth();
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <nav className="bg-white shadow mb-4">
      <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-xl text-primary">
          Minha Loja
        </Link>
        <div className="flex gap-4 items-center text-sm">
          <Link to="/cart" className="relative">
            Carrinho
            <span className="ml-1 text-xs bg-primary text-white px-2 py-0.5 rounded-full">
              {totalItems}
            </span>
          </Link>

          {isAdmin && (
            <Link to="/admin" className="text-slate-700">
              Painel Admin
            </Link>
          )}

          {isAdmin && (
            <Link to="/admin/orders" className="text-slate-700">
              Pedidos
            </Link>
          )}


          {user ? (
            <>
              <span className="hidden sm:inline text-slate-600">
                Olá, {user.name}
              </span>
              <button
                onClick={logout}
                className="text-red-500 hover:underline"
              >
                Sair
              </button>
            </>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
