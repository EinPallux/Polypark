"use client";

import { useSyncExternalStore } from "react";
import { continueSlot } from "@/save/store";

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** Whether a continue-able park exists (drives title CONTINUE + hub buttons). */
export function useHasSave(): boolean {
  return useSyncExternalStore(
    subscribeToStorage,
    () => continueSlot() !== null,
    () => false,
  );
}
