import type {
  ApplicationCapabilities,
  Clock,
  FileTransfer,
  FullscreenCapability,
  RepositoryResult,
  Scheduler,
  TextFile,
} from "./types";

const platformFailure = (
  message: string,
  error: unknown,
): RepositoryResult<void> => ({
  ok: false,
  error: {
    code: "WRITE_FAILED",
    message,
    cause: error instanceof Error ? error.message : String(error),
  },
});

export const browserClock: Clock = { now: () => Date.now() };

export const browserScheduler: Scheduler = {
  setInterval: (callback, intervalMilliseconds) =>
    window.setInterval(callback, intervalMilliseconds),
  clearInterval: (handle) => {
    if (typeof handle === "number") window.clearInterval(handle);
  },
};

export class WebFileTransfer implements FileTransfer {
  downloadJson(filename: string, contents: string): RepositoryResult<void> {
    try {
      const url = URL.createObjectURL(
        new Blob([contents], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      return { ok: true, value: undefined };
    } catch (error: unknown) {
      return platformFailure("Could not download the save", error);
    }
  }

  async readText(file: TextFile): Promise<RepositoryResult<string>> {
    try {
      return { ok: true, value: await file.text() };
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          code: "READ_FAILED",
          message: "Could not read the selected file",
          cause: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

export class WebFullscreenCapability implements FullscreenCapability {
  readonly supported = document.fullscreenEnabled;

  async setEnabled(enabled: boolean): Promise<RepositoryResult<void>> {
    if (!this.supported)
      return platformFailure("Fullscreen is not supported", null);
    try {
      if (enabled && document.fullscreenElement === null)
        await document.documentElement.requestFullscreen();
      if (!enabled && document.fullscreenElement !== null)
        await document.exitFullscreen();
      return { ok: true, value: undefined };
    } catch (error: unknown) {
      return platformFailure("Could not change fullscreen mode", error);
    }
  }
}

export const webCapabilities: ApplicationCapabilities = {
  canQuit: false,
  developmentTools: __DEV_TOOLS__,
};
