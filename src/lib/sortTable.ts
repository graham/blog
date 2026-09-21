export type SortDir = "asc" | "desc";
export type TableSort = { col: number; dir: SortDir };

export function compareCell(a: string, b: string): number {
  const left = a.trim();
  const right = b.trim();
  if (left === "" && right === "") return 0;
  if (left === "") return 1;
  if (right === "") return -1;
  const leftNum = parseNumber(left);
  const rightNum = parseNumber(right);
  if (leftNum !== null && rightNum !== null) return leftNum - rightNum;
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[$,%\s]/g, "");
  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sortRowIndices(rows: string[][], col: number, dir: SortDir): number[] {
  const indices = rows.map((_, index) => index);
  indices.sort((left, right) => {
    const cmp = compareCell(rows[left]?.[col] ?? "", rows[right]?.[col] ?? "");
    return dir === "asc" ? cmp : -cmp;
  });
  return indices;
}

export function nextSort(current: TableSort | null, col: number): TableSort | null {
  if (!current || current.col !== col) return { col, dir: "asc" };
  if (current.dir === "asc") return { col, dir: "desc" };
  return null;
}
