export interface DiffLine {
  type: "equal" | "add" | "remove";
  text: string;
  /** 1-based line number in the original text; absent for an addition. */
  before?: number;
  /** 1-based line number in the changed text; absent for a removal. */
  after?: number;
}

/** A run of unchanged lines folded away to keep the diff readable. */
export interface DiffSkip {
  type: "skip";
  count: number;
}

interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
}

export type DiffResult = { lines: DiffLine[]; summary: DiffSummary } | { error: "tooLong" | "tooDifferent" };

/** Limits that keep a large paste from locking up the page. */
export const diffLimits = { characters: 200_000, lines: 5000, edits: 2000 };

const split = (text: string) => (text === "" ? [] : text.replace(/\r\n?/gu, "\n").split("\n"));

/**
 * Myers’ O(ND) shortest edit script over line ids. Returns the edit path as a list of
 * [removed, added] decisions, or undefined if the texts differ by more than `maxEdits` lines.
 */
const myers = (a: number[], b: number[], maxEdits: number) => {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, maxEdits);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= max; d++) {
    // Only diagonals -d…d are reachable at this depth, so keep just that slice for backtracking.
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0));
      let x = down ? (v[offset + k + 1] ?? 0) : (v[offset + k - 1] ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return { trace, d };
    }
  }
  return undefined;
};

/** Walks the Myers trace backwards into a list of operations, oldest first. */
const backtrack = (trace: Int32Array[], depth: number, n: number, m: number) => {
  const ops: DiffLine["type"][] = [];
  let x = n;
  let y = m;
  for (let d = depth; d > 0; d--) {
    const saved = trace[d] ?? new Int32Array(0);
    // `saved` holds diagonals -d-1…d+1, so diagonal k sits at index k + d + 1.
    const at = (k: number) => saved[k + d + 1] ?? 0;
    const k = x - y;
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const previousK = down ? k + 1 : k - 1;
    const previousX = at(previousK);
    const previousY = previousX - previousK;
    while (x > previousX && y > previousY) {
      ops.push("equal");
      x--;
      y--;
    }
    ops.push(down ? "add" : "remove");
    if (down) y--;
    else x--;
  }
  while (x > 0 && y > 0) {
    ops.push("equal");
    x--;
    y--;
  }
  return ops.reverse();
};

/** A line-by-line diff of two texts, with a count of what changed. */
export const diffLines = (before: string, after: string, limits = diffLimits): DiffResult => {
  if (before.length > limits.characters || after.length > limits.characters) return { error: "tooLong" };
  const a = split(before);
  const b = split(after);
  if (a.length > limits.lines || b.length > limits.lines) return { error: "tooLong" };

  // Compare small integers rather than strings, and trim the common prefix and suffix first:
  // most edits touch a few lines in the middle, which leaves Myers very little to do.
  const ids = new Map<string, number>();
  const id = (line: string) => {
    let value = ids.get(line);
    if (value === undefined) {
      value = ids.size;
      ids.set(line, value);
    }
    return value;
  };
  const left = a.map(id);
  const right = b.map(id);
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) start++;
  let end = 0;
  while (
    end < left.length - start &&
    end < right.length - start &&
    left[left.length - 1 - end] === right[right.length - 1 - end]
  ) {
    end++;
  }
  const middleLeft = left.slice(start, left.length - end);
  const middleRight = right.slice(start, right.length - end);
  const result = myers(middleLeft, middleRight, limits.edits);
  if (!result) return { error: "tooDifferent" };
  const ops = [
    ...Array<DiffLine["type"]>(start).fill("equal"),
    ...backtrack(result.trace, result.d, middleLeft.length, middleRight.length),
    ...Array<DiffLine["type"]>(end).fill("equal"),
  ];

  const lines: DiffLine[] = [];
  const summary: DiffSummary = { added: 0, removed: 0, unchanged: 0 };
  let i = 0;
  let j = 0;
  for (const type of ops) {
    if (type === "equal") {
      lines.push({ type, text: a[i] ?? "", before: ++i, after: ++j });
      summary.unchanged++;
    } else if (type === "remove") {
      lines.push({ type, text: a[i] ?? "", before: ++i });
      summary.removed++;
    } else {
      lines.push({ type, text: b[j] ?? "", after: ++j });
      summary.added++;
    }
  }
  return { lines, summary };
};

/** Folds runs of unchanged lines longer than twice `context`, keeping `context` lines around each change. */
export const collapse = (lines: DiffLine[], context = 3): (DiffLine | DiffSkip)[] => {
  const result: (DiffLine | DiffSkip)[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line?.type !== "equal") {
      if (line) result.push(line);
      index++;
      continue;
    }
    let runEnd = index;
    while (lines[runEnd]?.type === "equal") runEnd++;
    const keepBefore = index === 0 ? 0 : context;
    const keepAfter = runEnd === lines.length ? 0 : context;
    const hidden = runEnd - index - keepBefore - keepAfter;
    if (hidden > 1) {
      result.push(...lines.slice(index, index + keepBefore), { type: "skip", count: hidden });
      result.push(...lines.slice(runEnd - keepAfter, runEnd));
    } else result.push(...lines.slice(index, runEnd));
    index = runEnd;
  }
  return result;
};

export interface DiffRow {
  before: DiffLine | undefined;
  after: DiffLine | undefined;
}

/** Pairs removals with the additions that replace them, for a side-by-side view. */
export const sideBySide = (items: (DiffLine | DiffSkip)[]): (DiffRow | DiffSkip)[] => {
  const rows: (DiffRow | DiffSkip)[] = [];
  let removed: DiffLine[] = [];
  let added: DiffLine[] = [];
  const flush = () => {
    for (let i = 0; i < Math.max(removed.length, added.length); i++) {
      rows.push({ before: removed[i], after: added[i] });
    }
    removed = [];
    added = [];
  };
  for (const item of items) {
    if (item.type === "remove") removed.push(item);
    else if (item.type === "add") added.push(item);
    else {
      flush();
      rows.push(item.type === "skip" ? item : { before: item, after: item });
    }
  }
  flush();
  return rows;
};
