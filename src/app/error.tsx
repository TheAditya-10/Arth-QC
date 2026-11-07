"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Phase 2: report to monitoring
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h2 className="font-heading text-2xl font-bold">Oops, something went wrong</h2>
      <p className="max-w-sm text-muted-foreground">Don&apos;t worry — your progress is saved. Try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
