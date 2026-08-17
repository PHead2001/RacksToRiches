import type { Clock } from "../platform";

export type ErrorSource =
  | "bootstrap"
  | "runtime"
  | "save"
  | "storage"
  | "import"
  | "command"
  | "react"
  | "global";

export interface AppErrorRecord {
  id: string;
  timestamp: number;
  source: ErrorSource;
  message: string;
  detail: string;
}

export function normalizeError(
  error: unknown,
  source: ErrorSource,
  clock: Clock,
): AppErrorRecord {
  const timestamp = clock.now();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unknown failure occurred";
  const detail =
    error instanceof Error
      ? (error.stack ?? error.message)
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
  return {
    id: `${source}-${String(timestamp)}-${message.slice(0, 12)}`,
    timestamp,
    source,
    message,
    detail,
  };
}

export class BoundedErrorLog {
  private records: AppErrorRecord[] = [];

  constructor(
    private readonly clock: Clock,
    private readonly maximumRecords = 30,
  ) {}

  add(error: unknown, source: ErrorSource): AppErrorRecord {
    const record = normalizeError(error, source, this.clock);
    this.records = [...this.records, record].slice(-this.maximumRecords);
    return record;
  }

  list(): readonly AppErrorRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records = [];
  }
}
