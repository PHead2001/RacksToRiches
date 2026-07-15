import { createContext, useContext, type ReactNode } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import type { AppStoreState } from "../store";

const StoreContext = createContext<StoreApi<AppStoreState> | null>(null);

export function StoreProvider({
  store,
  children,
}: {
  store: StoreApi<AppStoreState>;
  children: ReactNode;
}) {
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}

export function useAppStore<T>(selector: (state: AppStoreState) => T): T {
  const store = useContext(StoreContext);
  if (store === null) throw new Error("StoreProvider is missing");
  return useStore(store, selector);
}
