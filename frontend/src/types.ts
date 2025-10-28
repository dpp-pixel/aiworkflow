// types.ts
export type ViolationReason =
  | "OUT_OF_METHOD_BODY" 
  | "IMPORT_ONLY_ALLOWED" 
  | "CONTEXT_MISMATCH"
  | "FILE_NOT_ALLOWED" 
  | "MULTI_FILE_NOT_SUPPORTED" 
  | "SIGNATURE_MISMATCH";

export interface Violation {
  file: string;
  hunkIndex: number;
  reason: ViolationReason;
  anchor: string;
  allowed?: { start: number; end: number };
  attempted?: { start: number; end: number };
}

export interface PatchResponse {
  ok: boolean;
  error?: string;
  violations?: Violation[];
  checkpointId?: string;
  apply?: {
    changedFiles: string[];
  };
  rationale?: string;
}

export interface BatchPatchResponse {
  ok: boolean;
  mode: "atomic" | "best_effort";
  results: {
    anchor: string;
    ok: boolean;
    changedFiles?: string[];
    error?: string;
    violations?: Violation[];
  }[];
  checkpointId?: string;
  reverted?: boolean;
  stats: {
    ok: number;
    failed: number;
  };
}

export interface MethodHighlight {
  error?: { start: number; end: number };
  allowed?: { start: number; end: number };
}