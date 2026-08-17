// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";

function BrokenScreen(): never {
  throw new Error("render exploded");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces a failed tree with actionable recovery controls", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onError = vi.fn();
    const onExport = vi.fn();
    const onReturnToMenu = vi.fn();
    const user = userEvent.setup();

    render(
      <ErrorBoundary
        diagnosticReport={() => "diagnostic"}
        onError={onError}
        onExport={onExport}
        onReturnToMenu={onReturnToMenu}
      >
        <BrokenScreen />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "The interface hit a bad packet",
    );
    await user.click(
      screen.getByRole("button", { name: "Export active state" }),
    );
    await user.click(screen.getByRole("button", { name: "Return to menu" }));
    expect(onExport).toHaveBeenCalledOnce();
    expect(onReturnToMenu).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });
});
