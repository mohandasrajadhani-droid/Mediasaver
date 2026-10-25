/**
 * The downloads library: a small global store (zustand) that is saved to the
 * phone with AsyncStorage, so the list survives app restarts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { reconcileAfterRestart } from '../download/rules';
import type { DownloadItem } from './types';

interface LibraryState {
  items: DownloadItem[];
  hydrated: boolean;
  add: (item: DownloadItem) => void;
  update: (id: string, patch: Partial<DownloadItem>) => void;
  remove: (id: string) => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set) => ({
      items: [],
      hydrated: false,
      add: (item) => set((s) => ({ items: [item, ...s.items] })),
      update: (id, patch) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
    }),
    {
      name: 'mediasaver-library-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        useLibrary.setState({ items: reconcileAfterRestart(state.items), hydrated: true });
      },
    },
  ),
);

export const getItem = (id: string) => useLibrary.getState().items.find((i) => i.id === id);
