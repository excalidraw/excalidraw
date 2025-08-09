import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserState {
  isLoggedIn: boolean;
  email: string | null;
  userId: string | null;

  setLoggedIn: (email: string | null, userId: string | null) => void;
  setLoggedOut: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      email: null,
      userId: null,

      setLoggedIn: (email, userId) => set({ isLoggedIn: true, email, userId }),
      setLoggedOut: () => set({ isLoggedIn: false, email: null, userId: null }),
    }),
    {
      name: "user-store",
    },
  ),
);
