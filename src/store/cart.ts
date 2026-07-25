import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  priceTTC: number;
  quantity: number;
  image?: string;
  vitrineQtyRemaining: number;
}

interface CartStore {
  items: CartItem[];
  tenantSlug: string | null;

  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setTenantSlug: (slug: string) => void;

  totalItems: () => number;
  totalTTC: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      tenantSlug: null,

      addItem: (item) => {
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: Math.min(i.quantity + 1, i.vitrineQtyRemaining) }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }] };
        });
      },

      removeItem: (productId) => {
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) }));
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId
              ? { ...i, quantity: Math.min(quantity, i.vitrineQtyRemaining) }
              : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      setTenantSlug: (slug) => set({ tenantSlug: slug }),

      totalItems: () => get().items.reduce((acc, i) => acc + i.quantity, 0),
      totalTTC: () => get().items.reduce((acc, i) => acc + i.priceTTC * i.quantity, 0),
    }),
    {
      name: 'artisastock-cart',
      partialize: (state) => ({ items: state.items, tenantSlug: state.tenantSlug }),
    }
  )
);
