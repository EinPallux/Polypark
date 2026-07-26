import { type SimState } from "../state";

/**
 * Every mutation of sim state flows through a command (TECHNICAL_ARCHITECTURE
 * §4.3) — the journal makes runs replayable and is the substrate for undo/redo
 * (lands with the placement core in M1).
 *
 * M0 ships the bus and two commands proving the pattern end to end.
 */
export type Command =
  | { readonly type: "park/rename"; readonly name: string }
  | { readonly type: "debug/noop" };

export type CommandResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

type CommandHandler<C extends Command> = (state: SimState, command: C) => CommandResult;

type HandlerMap = {
  [T in Command["type"]]: CommandHandler<Extract<Command, { type: T }>>;
};

const handlers: HandlerMap = {
  "park/rename": (state, command) => {
    const name = command.name.trim();
    if (name.length === 0 || name.length > 60) {
      return { ok: false, reason: "park name must be 1-60 characters" };
    }
    state.parkName = name;
    return { ok: true };
  },
  "debug/noop": () => ({ ok: true }),
};

export interface JournalEntry {
  readonly tick: number;
  readonly command: Command;
}

export interface CommandBus {
  dispatch(state: SimState, command: Command): CommandResult;
  journal(): readonly JournalEntry[];
}

export function createCommandBus(): CommandBus {
  const journal: JournalEntry[] = [];

  return {
    dispatch(state: SimState, command: Command): CommandResult {
      const handler = handlers[command.type] as CommandHandler<Command>;
      const result = handler(state, command);
      if (result.ok) {
        journal.push({ tick: state.tick, command });
      }
      return result;
    },
    journal(): readonly JournalEntry[] {
      return journal;
    },
  };
}
