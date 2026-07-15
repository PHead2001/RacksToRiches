import { advanceGame, assertGameState } from "../game";
import type { GameState } from "../game";
import type { Clock, Scheduler } from "../platform";

export type RuntimeSpeed = 1 | 5 | 25 | 100;

export interface RuntimeSession {
  state: GameState;
  paused: boolean;
  speed: RuntimeSpeed;
  freezeExpenses: boolean;
  autosaveEnabled: boolean;
  autosaveIntervalSeconds: 10 | 30 | 60;
}

export interface GameRuntimeDependencies {
  clock: Clock;
  scheduler: Scheduler;
  getSession(): RuntimeSession | null;
  setState(state: GameState): void;
  autosave(): Promise<void>;
  onError(error: unknown): void;
}

export class GameRuntime {
  private intervalHandle: unknown;
  private lastTickMilliseconds = 0;
  private lastAutosaveMilliseconds = 0;
  private tickInFlight = false;

  constructor(private readonly dependencies: GameRuntimeDependencies) {}

  get running(): boolean {
    return this.intervalHandle !== undefined;
  }

  start(): void {
    if (this.intervalHandle !== undefined) return;
    const now = this.dependencies.clock.now();
    this.lastTickMilliseconds = now;
    this.lastAutosaveMilliseconds = now;
    this.intervalHandle = this.dependencies.scheduler.setInterval(() => {
      void this.tick();
    }, 250);
  }

  stop(): void {
    if (this.intervalHandle === undefined) return;
    this.dependencies.scheduler.clearInterval(this.intervalHandle);
    this.intervalHandle = undefined;
  }

  async tick(): Promise<void> {
    if (this.tickInFlight) return;
    this.tickInFlight = true;
    try {
      const now = this.dependencies.clock.now();
      const elapsedSeconds = Math.max(
        0,
        (now - this.lastTickMilliseconds) / 1_000,
      );
      this.lastTickMilliseconds = now;
      const session = this.dependencies.getSession();
      if (session === null) return;
      if (!session.paused && elapsedSeconds > 0) {
        const previousExpenses = session.state.company.lifetimeExpenses;
        const advanced = advanceGame(
          session.state,
          elapsedSeconds * session.speed,
        );
        const next = session.freezeExpenses
          ? {
              ...advanced,
              company: {
                ...advanced.company,
                cash:
                  advanced.company.cash +
                  (advanced.company.lifetimeExpenses - previousExpenses),
                lifetimeExpenses: previousExpenses,
              },
            }
          : advanced;
        assertGameState(next);
        this.dependencies.setState(next);
      }
      if (
        session.autosaveEnabled &&
        now - this.lastAutosaveMilliseconds >=
          session.autosaveIntervalSeconds * 1_000
      ) {
        await this.dependencies.autosave();
        this.lastAutosaveMilliseconds = now;
      }
    } catch (error: unknown) {
      this.dependencies.onError(error);
    } finally {
      this.tickInFlight = false;
    }
  }
}
