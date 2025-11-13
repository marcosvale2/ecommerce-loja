import { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api";
import { useNavigate } from "react-router-dom";
import { QRCode } from "react-qrcode-logo";

// CONFIG DO SEU PIX
const PIX_KEY = "38e7c628-0161-4631-838d-13abca3a0261";
const PIX_MERCHANT_NAME = "Marcos";
const PIX_MERCHANT_CITY = "SAO LUIS";

function formatValue(amount) {
  return amount.toFixed(2);
}

function emvField(id, value) {
  const len = String(value.length).padStart(2, "0");
  return id + len + value;
}

function crc16(payload) {
  const polinomio = 0x1021;
  let resultado = 0xffff;

  for (let i = 0; i < payload.length; i++) {
    resultado ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((resultado & 0x8000) !== 0) {
        resultado = (resultado << 1) ^ polinomio;
      } else {
        resultado <<= 1;
      }
      resultado &= 0xffff;
    }
  }

  return resultado.toString(16).toUpperCase().padStart(4, "0");
}

function generatePixPayload({ key, name, city, amount, description }) {
  const gui = emvField("00", "br.gov.bcb.pix");
  const chave = emvField("01", key);
  const desc = description ? emvField("02", description) : "";
  const merchantAccountInfo = emvField("26", gui + chave + desc);

  const payloadSemCRC =
    emvField("00", "01") +
    emvField("01", "12") +
    merchantAccountInfo +
    emvField("52", "0000") +
    emvField("53", "986") +
    emvField("54", formatValue(amount)) +
    emvField("58", "BR") +
    emvField("59", name.substring(0, 25)) +
    emvField("60", city.substring(0, 15)) +
    emvField("62", emvField("05", "PEDIDO"));

  const toCRC = payloadSemCRC + "6304";
  const crc = crc16(toCRC);

  return payloadSemCRC + "6304" + crc;
}

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pixCode, setPixCode] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  async function handleCheckout(e) {
    e.preventDefault();

    if (!user) {
      alert("Você precisa estar logado para finalizar a compra.");
      return;
    }

    const payload = {
      total_price: total,
      items: items.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price
      }))
    };

    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setOrderId(res.display_number);

      const pixPayload = generatePixPayload({
        key: PIX_KEY,
        name: PIX_MERCHANT_NAME,
        city: PIX_MERCHANT_CITY,
        amount: total,
        description: `Pedido ${res.display_number}`
      });

      setPixCode(pixPayload);
      clearCart();

    } catch (err) {
      console.error(err);
      alert("Erro ao criar pedido.");
    }
  }

  async function handlePaymentConfirmation() {
    try {
      await apiFetch(`/api/orders/${orderId}/pay`, {
        method: "POST"
      });

      setPaymentConfirmed(true);
    } catch (err) {
      alert("Erro ao confirmar pagamento.");
    }
  }

  if (items.length === 0 && !pixCode) {
    return (
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-4">Checkout</h1>
        <p>Carrinho vazio.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>

      {!pixCode && (
        <form onSubmit={handleCheckout} className="grid gap-3 max-w-md">
          <input type="text" placeholder="Nome completo" className="border rounded px-3 py-2" required />
          <input type="text" placeholder="Endereço" className="border rounded px-3 py-2" required />
          <input type="text" placeholder="Cidade" className="border rounded px-3 py-2" required />
          <input type="text" placeholder="CEP" className="border rounded px-3 py-2" required />

          <p className="mt-2 font-bold">Total: R$ {total.toFixed(2)}</p>

          <button type="submit" className="mt-2 bg-primary text-white px-4 py-2 rounded">
            Confirmar pedido e gerar PIX
          </button>
        </form>
      )}

      {pixCode && (
        <div className="mt-10 bg-white shadow rounded-lg p-4 max-w-md">
          <h2 className="text-xl font-semibold mb-2">Pagamento via PIX</h2>

          <p className="text-sm mb-2">Pedido #{orderId}</p>

          {paymentConfirmed && (
            <div className="bg-green-200 text-green-800 font-semibold px-3 py-2 rounded mb-3">
              ✔ Pagamento confirmado com sucesso!
            </div>
          )}

          <p className="text-sm mb-4">Escaneie o QR Code abaixo:</p>

          <div className="flex justify-center mb-4">
            <QRCode value={pixCode} size={220} quietZone={10} />
          </div>

          <p className="text-sm font-semibold">Código PIX (copia e cola):</p>
          <textarea className="w-full border rounded px-2 py-1 text-xs mb-3" rows={4} readOnly value={pixCode} />

          {!paymentConfirmed && (
            <button
              className="w-full bg-green-600 text-white py-2 rounded font-semibold"
              onClick={handlePaymentConfirmation}
            >
              Já paguei
            </button>
          )}

          <button
            className="mt-4 text-sm text-blue-600 underline w-full"
            onClick={() => navigate("/")}
          >
            Voltar para a loja
          </button>
        </div>
      )}
    </div>
  );
}
