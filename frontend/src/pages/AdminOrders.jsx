import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../context/AuthContext";

export default function AdminOrders() {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    try {
      const data = await apiFetch("/api/orders/full");
      setOrders(data);
    } catch (err) {
      console.error("Erro ao carregar pedidos:", err);
      alert("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }

  async function deleteOrder(orderId) {
    if (!confirm(`Deseja excluir o pedido #${orderId}?`)) return;

    try {
      await apiFetch(`/api/orders/${orderId}`, {
        method: "DELETE",
      });

      setOrders((prev) => prev.filter((o) => o.order_id !== orderId));
      alert("Pedido deletado com sucesso!");
    } catch (err) {
      console.error("Erro ao deletar pedido:", err);
      alert("Erro ao deletar pedido");
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-4">Pedidos</h1>
        <p>Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-4">Pedidos</h1>
        <p>Carregando pedidos...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-6">Pedidos Realizados</h1>

      {orders.length === 0 ? (
        <p>Nenhum pedido encontrado.</p>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.order_id}
              className="bg-white shadow rounded-lg p-4 border"
            >
              {/* Cabeçalho do pedido */}
              <div className="flex justify-between items-center border-b pb-2 mb-3">
                <h2 className="font-bold text-lg">
                  Pedido #{order.order_id}
                </h2>

                <button
                  onClick={() => deleteOrder(order.order_id)}
                  className="text-red-500 hover:underline text-sm"
                >
                  Excluir Pedido
                </button>
              </div>

              {/* Info Cliente */}
              <div className="text-sm mb-4">
                <p>
                  <strong>Cliente:</strong> {order.user.name} ({" "}
                  {order.user.email} )
                </p>
                <p>
                  <strong>Data:</strong>{" "}
                  {new Date(order.created_at).toLocaleString()}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className="text-blue-600">{order.status}</span>
                </p>
              </div>

              {/* Itens do pedido */}
              <div>
                <h3 className="font-semibold mb-2">Itens do Pedido:</h3>
                <div className="space-y-2">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between border-b pb-1"
                    >
                      <span>
                        {item.product_name} (x{item.quantity})
                      </span>
                      <span className="font-semibold">
                        R$ {(item.unit_price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <p className="text-right mt-4 font-bold text-lg text-primary">
                Total: R$ {order.total_price.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
