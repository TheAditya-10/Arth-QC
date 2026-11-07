import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-lavender/50 px-6 text-center">
      <Logo />
      <p className="font-heading text-7xl font-bold text-indigo-200">404</p>
      <h1 className="font-heading text-2xl font-bold">This page went missing</h1>
      <p className="max-w-sm text-muted-foreground">Even the best explorers take a wrong turn sometimes. Let&apos;s head back.</p>
      <Button asChild size="lg">
        <Link href="/">Back to start</Link>
      </Button>
    </div>
  );
}
