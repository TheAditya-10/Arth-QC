"use client";

import { ErrorState } from "@/components/shared/states";
import { Onboarding } from "@/components/parent/onboarding";
import { ApiClientError } from "@/lib/client/api";
import { refresh, useStore, useStoreError } from "@/lib/client/store";

/** Shows onboarding for new families, or a friendly error with retry if state can't load. */
export function StateGate({ children }: { children: React.ReactNode }) {
  const loaded = useStore((db) => db.version);
  const error = useStoreError();
  if (!loaded && error instanceof ApiClientError && error.code === "ONBOARDING_REQUIRED") return <Onboarding />;
  if (!loaded && error) {
    return (
      <div className="py-10">
        <ErrorState title="We couldn't load your data" description={error.message} onRetry={() => void refresh()} />
      </div>
    );
  }
  return <>{children}</>;
}
