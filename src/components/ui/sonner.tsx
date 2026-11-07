"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "rounded-2xl border border-border bg-card text-foreground shadow-soft font-sans",
          title: "font-semibold",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
