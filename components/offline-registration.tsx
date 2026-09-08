"use client";

import { useEffect } from "react";

export function OfflineRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      // No forced activation: an update must not interrupt a running game.
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
