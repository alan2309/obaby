// src/context/CartContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Product, ProductVariant } from '../firebase/firestore';

export interface CartItem {
  product: Product;
  sizeVariant: ProductVariant;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string, size: string, color: string) => void;
  updateQuantity: (productId: string, size: string, color: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalAmount: () => number;
  getTotalCost: () => number;
  getTotalProfit: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const addToCart = (newItem: CartItem) => {
    setCartItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(
        item => 
          item.product.id === newItem.product.id && 
          item.sizeVariant.size === newItem.sizeVariant.size &&
          item.sizeVariant.color === newItem.sizeVariant.color
      );

      if (existingItemIndex > -1) {
        // Update quantity if item already exists
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex].quantity += newItem.quantity;
        return updatedItems;
      } else {
        // Add new item
        return [...prevItems, newItem];
      }
    });
  };

  const removeFromCart = (productId: string, size: string, color: string) => {
    setCartItems(prevItems =>
      prevItems.filter(
        item => !(
          item.product.id === productId && 
          item.sizeVariant.size === size && 
          item.sizeVariant.color === color
        )
      )
    );
  };

  const updateQuantity = (productId: string, size: string, color: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, size, color);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.product.id === productId && 
        item.sizeVariant.size === size && 
        item.sizeVariant.color === color
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalAmount = () => {
    return cartItems.reduce((total, item) => {
      const sellingPrice = item.product.sellingPrice || 0;
      return total + (sellingPrice * item.quantity);
    }, 0);
  };

  const getTotalCost = () => {
    return cartItems.reduce((total, item) => {
      const costPrice = item.product.costPrice || 0;
      return total + (costPrice * item.quantity);
    }, 0);
  };

  const getTotalProfit = () => {
    return getTotalAmount() - getTotalCost();
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalItems,
        getTotalAmount,
        getTotalCost,
        getTotalProfit,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};