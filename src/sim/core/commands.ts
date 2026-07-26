import { addMoney, money, scaleMoney, subMoney } from "@/shared/money";
import { SHOP_DEFS } from "@/content/shops";
import { type SimState } from "../state";
import { invalidatePathCache } from "../guests/guests";
import { dismissGoal } from "../goals/goals";
import {
  cellIndex,
  checkPaintPath,
  checkPlace,
  footprintCells,
  PATH_OCCUPANT,
  type PlaceDenial,
  type Rotation,
} from "../world/world";

/**
 * Every mutation of sim state flows through a command (TECH §4.3). Successful
 * handlers return the exact inverse command, which powers the undo/redo stacks
 * (GAME_DESIGN §8.1) and keeps money deltas perfectly symmetric.
 */
export type Command =
  | { readonly type: "park/rename"; readonly name: string }
  | {
      readonly type: "build/place";
      readonly pieceId: string;
      readonly x: number;
      readonly z: number;
      readonly rot: Rotation;
      /** Internal (undo/restore): reuse an instance id. */
      readonly forceId?: number;
      /** Internal: charge this instead of list price (exact-inverse money). */
      readonly forceCostCents?: number;
      /** Internal: record this as the piece's paid amount. */
      readonly forcePaidCents?: number;
      readonly forcePlacedAtTick?: number;
    }
  | {
      readonly type: "build/remove";
      readonly id: number;
      /** "bulldoze" applies the refund policy; "exact" refunds paidCents (undo). */
      readonly refund: "bulldoze" | "exact";
    }
  | {
      readonly type: "build/paintPath";
      readonly cells: readonly { readonly x: number; readonly z: number }[];
      readonly forceCostCentsPerCell?: number;
    }
  | {
      readonly type: "build/erasePath";
      readonly cells: readonly { readonly x: number; readonly z: number }[];
      readonly refundCentsPerCell?: number;
    }
  | { readonly type: "park/setOpen"; readonly open: boolean }
  | { readonly type: "park/setEntryFee"; readonly cents: number }
  | { readonly type: "staff/hireJanitor" }
  | { readonly type: "staff/fireJanitor" }
  | { readonly type: "goal/dismiss"; readonly cardId: string }
  | { readonly type: "debug/noop" };

export type CommandFailure = PlaceDenial | "invalid" | "nothing-to-do";

export type CommandResult =
  | {
      readonly ok: true;
      readonly inverse?: Command;
      /**
       * Canonical form for redo: pins ids/amounts decided during application so
       * replaying reproduces the identical state (undo-fuzz invariant).
       */
      readonly replay?: Command;
    }
  | { readonly ok: false; readonly reason: CommandFailure };

/** Bulldoze refund policy (GAME_BALANCE §3.2): 70%, or 100% within 300 ticks. */
const BULLDOZE_REFUND_RATE = 0.7;
const FULL_REFUND_TICKS = 300;
const PATH_LIST_COST_CENTS = 40_00;

type Handler<C extends Command> = (state: SimState, command: C) => CommandResult;

type HandlerMap = { [T in Command["type"]]: Handler<Extract<Command, { type: T }>> };

const handlers: HandlerMap = {
  "park/rename": (state, command) => {
    const name = command.name.trim();
    if (name.length === 0 || name.length > 60) {
      return { ok: false, reason: "invalid" };
    }
    const previous = state.parkName;
    state.parkName = name;
    return { ok: true, inverse: { type: "park/rename", name: previous } };
  },

  "build/place": (state, command) => {
    const check = checkPlace(state.world, command.pieceId, command.x, command.z, command.rot);
    if (!check.ok) {
      return { ok: false, reason: check.reason ?? "invalid" };
    }
    const def = state.world.pieces.get(command.pieceId);
    if (!def) {
      return { ok: false, reason: "unknown-piece" };
    }
    const cost = money(command.forceCostCents ?? def.cost);
    if (state.money < cost) {
      return { ok: false, reason: "not-enough-money" };
    }
    const id = command.forceId ?? state.world.nextInstanceId;
    if (command.forceId === undefined) {
      state.world.nextInstanceId += 1;
    } else {
      state.world.nextInstanceId = Math.max(state.world.nextInstanceId, id + 1);
    }
    const piece = {
      id,
      pieceId: command.pieceId,
      x: command.x,
      z: command.z,
      rot: command.rot,
      placedAtTick: command.forcePlacedAtTick ?? state.tick,
      paidCents: command.forcePaidCents ?? def.cost,
    };
    state.world.placed.set(id, piece);
    for (const cell of footprintCells(def, command.x, command.z, command.rot)) {
      state.world.occupancy[cellIndex(state.world, cell.x, cell.z)] = id;
    }
    state.money = subMoney(state.money, cost);
    state.ledger.expense.construction += cost;
    if (command.forceId === undefined) {
      if (SHOP_DEFS[command.pieceId]) {
        state.stats.shopsBuilt += 1;
      } else if (def.category === "scenery" || def.category === "prop") {
        state.stats.sceneryPlaced += 1;
      }
    }
    return {
      ok: true,
      inverse: { type: "build/remove", id, refund: "exact" },
      replay: { ...command, forceId: id, forcePaidCents: piece.paidCents, forcePlacedAtTick: piece.placedAtTick },
    };
  },

  "build/remove": (state, command) => {
    const piece = state.world.placed.get(command.id);
    if (!piece) {
      return { ok: false, reason: "nothing-to-do" };
    }
    const def = state.world.pieces.get(piece.pieceId);
    const paid = money(piece.paidCents);
    const refund =
      command.refund === "exact"
        ? paid
        : state.tick - piece.placedAtTick <= FULL_REFUND_TICKS
          ? paid
          : scaleMoney(paid, BULLDOZE_REFUND_RATE);
    state.world.placed.delete(command.id);
    if (def) {
      for (const cell of footprintCells(def, piece.x, piece.z, piece.rot)) {
        state.world.occupancy[cellIndex(state.world, cell.x, cell.z)] = 0;
      }
    }
    state.money = addMoney(state.money, refund);
    state.ledger.expense.construction -= refund;
    return {
      ok: true,
      inverse: {
        type: "build/place",
        pieceId: piece.pieceId,
        x: piece.x,
        z: piece.z,
        rot: piece.rot,
        forceId: piece.id,
        forceCostCents: refund, // undoing re-charges exactly what was refunded…
        forcePaidCents: piece.paidCents, // …while restoring the original paid record
        forcePlacedAtTick: piece.placedAtTick,
      },
    };
  },

  "build/paintPath": (state, command) => {
    const applied: { x: number; z: number }[] = [];
    const seen = new Set<number>();
    for (const cell of command.cells) {
      const index = cellIndex(state.world, cell.x, cell.z);
      if (seen.has(index)) {
        continue;
      }
      if (checkPaintPath(state.world, cell.x, cell.z).ok) {
        seen.add(index);
        applied.push({ x: cell.x, z: cell.z });
      }
    }
    if (applied.length === 0) {
      return { ok: false, reason: "nothing-to-do" };
    }
    const perCell = money(command.forceCostCentsPerCell ?? PATH_LIST_COST_CENTS);
    const total = money(perCell * applied.length);
    if (state.money < total) {
      return { ok: false, reason: "not-enough-money" };
    }
    for (const cell of applied) {
      const index = cellIndex(state.world, cell.x, cell.z);
      state.world.pathCells[index] = 1;
      state.world.occupancy[index] = PATH_OCCUPANT;
    }
    state.money = subMoney(state.money, total);
    state.ledger.expense.construction += total;
    if (command.forceCostCentsPerCell === undefined) {
      state.stats.pathCellsBuilt += applied.length;
    }
    invalidatePathCache();
    return {
      ok: true,
      inverse: { type: "build/erasePath", cells: applied, refundCentsPerCell: perCell },
      // Pin the per-cell cost so redo charges identically AND skips the
      // monotonic stat counters (they must not double-count on redo).
      replay: { ...command, cells: applied, forceCostCentsPerCell: perCell },
    };
  },

  "build/erasePath": (state, command) => {
    const applied: { x: number; z: number }[] = [];
    for (const cell of command.cells) {
      if (!state.world.terrain.inBounds(cell.x, cell.z)) {
        continue;
      }
      const index = cellIndex(state.world, cell.x, cell.z);
      if (state.world.pathCells[index] === 1) {
        applied.push({ x: cell.x, z: cell.z });
      }
    }
    if (applied.length === 0) {
      return { ok: false, reason: "nothing-to-do" };
    }
    const refundPerCell = money(
      command.refundCentsPerCell ?? Math.round(PATH_LIST_COST_CENTS * BULLDOZE_REFUND_RATE),
    );
    for (const cell of applied) {
      const index = cellIndex(state.world, cell.x, cell.z);
      state.world.pathCells[index] = 0;
      state.world.occupancy[index] = 0;
    }
    state.money = addMoney(state.money, money(refundPerCell * applied.length));
    state.ledger.expense.construction -= refundPerCell * applied.length;
    invalidatePathCache();
    return {
      ok: true,
      inverse: {
        type: "build/paintPath",
        cells: applied,
        forceCostCentsPerCell: refundPerCell,
      },
      replay: { ...command, cells: applied },
    };
  },

  // Session/management commands are deliberately NOT undoable (no inverse):
  // Ctrl+Z is for construction, not for un-closing your park.
  "park/setOpen": (state, command) => {
    state.parkOpen = command.open;
    return { ok: true };
  },
  "park/setEntryFee": (state, command) => {
    if (!Number.isInteger(command.cents) || command.cents < 0 || command.cents > 100_00) {
      return { ok: false, reason: "invalid" };
    }
    state.entryFeeCents = command.cents;
    return { ok: true };
  },
  "staff/hireJanitor": (state) => {
    const HIRE_FEE = money(150_00); // GAME_BALANCE §7
    if (state.money < HIRE_FEE) {
      return { ok: false, reason: "not-enough-money" };
    }
    state.money = subMoney(state.money, HIRE_FEE);
    state.ledger.expense.wages += HIRE_FEE;
    const gate = state.world.terrain.site.gate;
    state.janitors.push({
      id: state.nextJanitorId,
      x: (gate.x + 0.5) * 2,
      z: (gate.z + 0.5) * 2,
      path: [],
      targetLitterId: -1,
      cleanTicks: 0,
    });
    state.nextJanitorId += 1;
    state.stats.janitorsHired += 1;
    return { ok: true };
  },
  "staff/fireJanitor": (state) => {
    if (state.janitors.length === 0) {
      return { ok: false, reason: "nothing-to-do" };
    }
    state.janitors.pop();
    return { ok: true };
  },
  "goal/dismiss": (state, command) => {
    return dismissGoal(state, command.cardId)
      ? { ok: true }
      : { ok: false, reason: "nothing-to-do" };
  },
  "debug/noop": () => ({ ok: true }),
};

export interface JournalEntry {
  readonly tick: number;
  readonly command: Command;
}

const UNDO_DEPTH = 100;

export interface CommandBus {
  dispatch(state: SimState, command: Command): CommandResult;
  undo(state: SimState): boolean;
  redo(state: SimState): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  journal(): readonly JournalEntry[];
}

interface UndoEntry {
  readonly command: Command;
  readonly inverse: Command;
}

export function createCommandBus(): CommandBus {
  const journal: JournalEntry[] = [];
  const undoStack: UndoEntry[] = [];
  const redoStack: UndoEntry[] = [];

  const apply = (state: SimState, command: Command): CommandResult => {
    const handler = handlers[command.type] as Handler<Command>;
    const result = handler(state, command);
    if (result.ok) {
      journal.push({ tick: state.tick, command });
    }
    return result;
  };

  return {
    dispatch(state, command): CommandResult {
      const result = apply(state, command);
      if (result.ok && result.inverse) {
        undoStack.push({ command: result.replay ?? command, inverse: result.inverse });
        if (undoStack.length > UNDO_DEPTH) {
          undoStack.shift();
        }
        redoStack.length = 0;
      }
      return result;
    },
    undo(state): boolean {
      const entry = undoStack.pop();
      if (!entry) {
        return false;
      }
      const result = apply(state, entry.inverse);
      if (result.ok) {
        redoStack.push(entry);
        return true;
      }
      return false;
    },
    redo(state): boolean {
      const entry = redoStack.pop();
      if (!entry) {
        return false;
      }
      const result = apply(state, entry.command);
      if (result.ok && result.inverse) {
        undoStack.push({ command: entry.command, inverse: result.inverse });
        return true;
      }
      return false;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    journal: () => journal,
  };
}
