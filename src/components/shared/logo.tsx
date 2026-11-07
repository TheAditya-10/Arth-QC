import Link from "next/link";
import { cn } from "@/lib/utils";

/** Arth-QC mark: a stacked "notebook" square with a checkmark that doubles as a rising progress line. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect x="4" y="6" width="30" height="30" rx="8" fill="#FFD66B" />
      <rect x="7" y="3" width="30" height="30" rx="8" fill="#292B59" />
      <path d="M14 18.5l4.5 4.5L30 11.5" fill="none" stroke="#FFD66B" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="30" cy="11.5" r="2.4" fill="#BCEBD6" />
    </svg>
  );
}

export function Logo({ href = "/", className, sub }: { href?: string; className?: string; sub?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Arth-QC home">
      <LogoMark className="transition-transform group-hover:-rotate-6" />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-xl font-bold tracking-tight text-indigo">
          Arth<span className="text-coral-dark">-</span>QC
        </span>
        {sub && <span className="mt-0.5 hidden whitespace-nowrap text-[10px] sm:block font-semibold uppercase tracking-[0.14em] text-muted-foreground">{sub}</span>}
      </span>
    </Link>
  );
}
