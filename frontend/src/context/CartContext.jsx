import { createContext, useContext, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  function addToCart(product, quantity = 1) {
    setItems((current) => {
      const existing = current.find((i) => i.id === product.id);
      if (existing) {
        return current.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...current, { ...product, quantity }];
    });
  }

  function removeFromCart(id) {
    setItems((current) => current.filter((i) => i.id !== id));
  }

  function clearCart() {
    setItems([]);
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, clearCart, total }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
