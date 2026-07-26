/**
 * SimFacade — the ONLY surface render/ui/app may import from the simulation
 * (TECHNICAL_ARCHITECTURE §3, enforced by ESLint + dependency-cruiser).
 *
 * The interface is message-shaped on purpose: commands/queries in, snapshots
 * and event batches out, so moving the sim into a Web Worker (TECH §4.4) is a
 * transport change, not a redesign.
 */
import { createCommandBus, type Command, type CommandResult } from "./core/commands";
import { createEventCollector, type SimEvent } from "./core/events";
import { createInitialState, restoreState, snapshotState, type SimStateSnapshot } from "./state";
import { stateHash } from "./core/hash";

export type { Command, CommandResult, SimEvent, SimStateSnapshot };
export { createFixedStepper, TICKS_PER_SECOND, type GameSpeed } from "./core/loop";

export interface SimFacade {
  /** Advance the simulation by whole ticks (the stepper decides how many). */
  advance(ticks: number): void;
  dispatch(command: Command): CommandResult;
  snapshot(): SimStateSnapshot;
  drainEvents(): SimEvent[];
  /** Structural hash for determinism tests and save integrity. */
  hash(): string;
}

export interface CreateSimOptions {
  readonly seed: number;
  readonly parkName?: string;
  /** Resume from a saved snapshot instead of a fresh park. */
  readonly resumeFrom?: SimStateSnapshot;
}

export function createSim(options: CreateSimOptions): SimFacade {
  const state = options.resumeFrom
    ? restoreState(options.resumeFrom)
    : createInitialState(options.seed, options.parkName ?? "My Polypark");
  const bus = createCommandBus();
  const events = createEventCollector();

  events.emit({ type: "sim/started", seed: state.seed });

  return {
    advance(ticks: number): void {
      // System order is fixed and versioned (TECH §4.1). M0 has no systems yet;
      // each milestone appends its slice here, never reorders existing ones.
      for (let i = 0; i < ticks; i++) {
        state.tick += 1;
      }
    },
    dispatch(command: Command): CommandResult {
      const result = bus.dispatch(state, command);
      if (result.ok && command.type === "park/rename") {
        events.emit({ type: "park/renamed", name: state.parkName });
      }
      return result;
    },
    snapshot(): SimStateSnapshot {
      return snapshotState(state);
    },
    drainEvents(): SimEvent[] {
      return events.drain();
    },
    hash(): string {
      return stateHash(snapshotState(state));
    },
  };
}
