export interface PresignedPut {
  url: string;
  method: "PUT";
  /** Headers the client must send verbatim (they are part of the signature). */
  headers: Record<string, string>;
  expiresAt: string;
}

export interface StorageDriver {
  readonly name: "r2" | "db" | "local";
  presignPut(key: string, opts: { contentType: string; contentLength: number; expiresIn: number }): Promise<PresignedPut>;
  presignGet(key: string, opts: { expiresIn: number; downloadName?: string }): Promise<string>;
  head(key: string): Promise<{ size: number; contentType: string | null } | null>;
  getBytes(key: string, range?: { start: number; end: number }): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
