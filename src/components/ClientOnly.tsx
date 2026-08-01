"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Render children only after mount so Zustand-persisted state never
 * mismatches SSR HTML (session ids, timestamps, localStorage).
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
