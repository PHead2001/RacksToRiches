import { z } from "zod";

import type {
  AppOptions,
  KeyValueStorage,
  OptionsRepository,
  RepositoryResult,
} from "./types";

export const DEFAULT_OPTIONS: AppOptions = {
  uiScale: "standard",
  reducedMotion: false,
  compactNumbers: true,
  autosaveEnabled: true,
  autosaveIntervalSeconds: 10,
  fullscreen: false,
};

const optionsSchema = z
  .object({
    uiScale: z.enum(["compact", "standard", "large"]),
    reducedMotion: z.boolean(),
    compactNumbers: z.boolean(),
    autosaveEnabled: z.boolean(),
    autosaveIntervalSeconds: z.union([
      z.literal(10),
      z.literal(30),
      z.literal(60),
    ]),
    fullscreen: z.boolean(),
  })
  .strict();

const OPTIONS_KEY = "racks-to-riches:options";

export class WebOptionsRepository implements OptionsRepository {
  constructor(private readonly storage: KeyValueStorage) {}

  async load(): Promise<RepositoryResult<AppOptions>> {
    await Promise.resolve();
    try {
      const raw = this.storage.getItem(OPTIONS_KEY);
      if (raw === null) return { ok: true, value: { ...DEFAULT_OPTIONS } };
      let input: unknown;
      try {
        input = JSON.parse(raw);
      } catch (error: unknown) {
        return {
          ok: false,
          error: {
            code: "INVALID_DATA",
            message: "Saved options are malformed",
            cause: error instanceof Error ? error.message : String(error),
          },
        };
      }
      const parsed = optionsSchema.safeParse(input);
      return parsed.success
        ? { ok: true, value: parsed.data }
        : {
            ok: false,
            error: {
              code: "INVALID_DATA",
              message: "Saved options are invalid",
              cause: parsed.error.issues
                .map(({ message }) => message)
                .join("; "),
            },
          };
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          code: "READ_FAILED",
          message: "Could not read options",
          cause: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  async save(options: AppOptions): Promise<RepositoryResult<void>> {
    await Promise.resolve();
    const parsed = optionsSchema.safeParse(options);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "INVALID_DATA",
          message: "Options are invalid",
          cause: parsed.error.issues.map(({ message }) => message).join("; "),
        },
      };
    }
    try {
      this.storage.setItem(OPTIONS_KEY, JSON.stringify(parsed.data));
      return { ok: true, value: undefined };
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          code: "WRITE_FAILED",
          message: "Could not save options",
          cause: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
