import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/api/types";

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  variantSku?: string; // backend cart uses SKU
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  wishlistIds: string[];

  openCart: () => void;
  closeCart: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, color?: string, size?: string) => void;
  updateQuantity: (productId: string, quantity: number, color?: string, size?: string) => void;
  clearCart: () => void;

  toggleWishlist: (productId: string) => void;

  getCartTotal: () => number;
  getCartCount: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      wishlistIds: [],

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addItem: (newItem) => {
        set((state) => {
          const existingItemIndex = state.items.findIndex(
            (i) =>
              i.product.id === newItem.product.id &&
              i.selectedColor === newItem.selectedColor &&
              i.selectedSize === newItem.selectedSize
          );

          if (existingItemIndex > -1) {
            const newItems = [...state.items];
            newItems[existingItemIndex].quantity += newItem.quantity;
            return { items: newItems, isOpen: true };
          }

          return { items: [...state.items, newItem], isOpen: true };
        });
      },

      removeItem: (productId, color, size) => {
        set((state) => ({
          items: state.items.filter(
            (i) =>
              !(
                i.product.id === productId &&
                i.selectedColor === color &&
                i.selectedSize === size
              )
          ),
        }));
      },

      updateQuantity: (productId, quantity, color, size) => {
        set((state) => ({
          items: state.items.map((i) => {
            if (
              i.product.id === productId &&
              i.selectedColor === color &&
              i.selectedSize === size
            ) {
              return { ...i, quantity: Math.max(1, quantity) };
            }
            return i;
          }),
        }));
      },

      clearCart: () => set({ items: [] }),

      toggleWishlist: (productId) => {
        set((state) => {
          const isWished = state.wishlistIds.includes(productId);
          return {
            wishlistIds: isWished
              ? state.wishlistIds.filter((id) => id !== productId)
              : [...state.wishlistIds, productId],
          };
        });
      },

      getCartTotal: () => {
        return get().items.reduce(
          (total, item) => total + item.product.price * item.quantity,
          0
        );
      },

      getCartCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: "anpamart-cart-storage",
      partialize: (state) => ({ items: state.items, wishlistIds: state.wishlistIds }),
    }
  )
);
