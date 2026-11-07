"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, FileText, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { LocalFile } from "@/lib/client/submission.service";
import { submissionService } from "@/lib/client";
import { cn, formatBytes, uid } from "@/lib/utils";

const MAX_FILES = 10;
const MAX_IMAGE = 25 * 1024 * 1024; // large photos are downscaled before upload
const MAX_PDF = 20 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

export function FileDropzone({ files, onChange, disabled }: { files: LocalFile[]; onChange: (f: LocalFile[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(0);

  const addFiles = useCallback(
    async (list: FileList | File[]) => {
      const incoming = Array.from(list);
      const room = MAX_FILES - files.length;
      if (room <= 0) {
        toast.error(`You can upload up to ${MAX_FILES} files.`);
        return;
      }
      const valid = incoming.filter((f) => {
        const ok = ALLOWED.includes(f.type);
        const max = f.type === "application/pdf" ? MAX_PDF : MAX_IMAGE;
        if (!ok) toast.error(`${f.name}: please use JPG, PNG, WEBP or PDF.`);
        else if (f.size > max) toast.error(`${f.name} is larger than ${max / 1048576} MB.`);
        return ok && f.size <= max;
      });
      const take = valid.slice(0, room);
      if (valid.length > room) toast.warning(`Only ${room} more file${room === 1 ? "" : "s"} can be added.`);
      if (!take.length) return;
      setProcessing(take.length);
      const prepared: LocalFile[] = [];
      for (const f of take) {
        const isPdf = f.type === "application/pdf";
        prepared.push({
          id: uid("f"),
          name: f.name,
          kind: isPdf ? "pdf" : "image",
          size: f.size,
          previewUrl: isPdf ? "" : await submissionService.fileToPreview(f),
          file: f,
        });
      }
      setProcessing(0);
      onChange([...files, ...prepared]);
    },
    [files, onChange],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        aria-label="Upload notebook photos or PDF. Drag and drop files or press Enter to browse."
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging ? "border-indigo bg-lavender" : "border-indigo-200 bg-card hover:border-indigo-300 hover:bg-lavender/40",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <motion.div
          animate={dragging ? { scale: 1.1, rotate: -4 } : { scale: 1, rotate: 0 }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sun text-indigo shadow-[0_3px_0_#B98A12]"
        >
          <ImagePlus className="h-8 w-8" />
        </motion.div>
        <p className="mt-4 font-heading text-lg font-semibold">{dragging ? "Drop your pages here!" : "Add photos of your notebook"}</p>
        <p className="mt-1 text-sm text-muted-foreground">Drag & drop, or tap to choose · JPG, PNG, WEBP or PDF · up to {MAX_FILES} files</p>
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-indigo-400">
          <Camera className="h-4 w-4" /> Tip: take photos in good light, one page per photo
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {(files.length > 0 || processing > 0) && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Uploaded files">
          <AnimatePresence>
            {files.map((f, i) => (
              <motion.li
                key={f.id}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="group relative overflow-hidden rounded-2xl border bg-card shadow-soft"
              >
                <div className="relative aspect-[3/4] bg-paper">
                  {f.kind === "image" && f.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.previewUrl} alt={`Page ${i + 1}: ${f.name}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-coral-dark">
                      <FileText className="h-10 w-10" />
                      <span className="text-xs font-bold uppercase">{f.kind === "pdf" ? "PDF" : "Image"}</span>
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-indigo/85 px-2 py-0.5 text-[11px] font-bold text-white">Page {i + 1}</span>
                </div>
                <div className="px-2.5 py-2">
                  <p className="truncate text-xs font-semibold">{f.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</p>
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(files.filter((x) => x.id !== f.id))}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-coral-dark shadow transition hover:bg-coral hover:text-white"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </motion.li>
            ))}
            {processing > 0 && (
              <li className="flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                <Loader2 className="mb-2 h-6 w-6 animate-spin" /> Preparing {processing}…
              </li>
            )}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
