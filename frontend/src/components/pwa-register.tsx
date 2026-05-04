"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const clearLocalServiceWorkers = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.unregister())
        );

        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(
            cacheKeys
              .filter((key) => key.startsWith("kadaserve-pwa-"))
              .map((key) => caches.delete(key))
          );
        }
      } catch (error) {
        console.warn("KadaServe local PWA cleanup failed", error);
      }
    };

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.warn("KadaServe PWA registration failed", error);
      }
    };

    if (process.env.NODE_ENV === "production") {
      void registerServiceWorker();
    } else {
      void clearLocalServiceWorkers();
    }
  }, []);

  return null;
}
