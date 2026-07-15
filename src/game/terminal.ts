import { BANKRUPTCY_THRESHOLD } from "./constants";
import type { GameState } from "./types";

export function evaluateBankruptcy(
  state: GameState,
  tutorialFailed = false,
): GameState {
  if (state.company.cash > BANKRUPTCY_THRESHOLD) return state;
  if (
    state.progression.terminalState?.kind === "bankrupt" &&
    state.progression.terminalState.tutorialFailed === tutorialFailed
  ) {
    return state;
  }
  return {
    ...state,
    progression: {
      ...state.progression,
      terminalState: {
        kind: "bankrupt",
        occurredAtSeconds: state.clockSeconds,
        tutorialFailed,
      },
    },
  };
}

export function isTerminal(state: GameState): boolean {
  return state.progression.terminalState !== null;
}
