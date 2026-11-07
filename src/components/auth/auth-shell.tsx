import { Logo } from "@/components/shared/logo";
import { Mascot } from "@/components/shared/mascot";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-lavender/60">
      <div className="bg-dots absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <Logo />
        <div className="flex flex-1 flex-col justify-center py-8">
          <div className="mb-5 flex items-center gap-3">
            <Mascot className="h-16 w-16" mood="wave" />
            <div>
              <h1 className="font-heading text-2xl font-bold">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="rounded-3xl border bg-card p-5 shadow-soft sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
