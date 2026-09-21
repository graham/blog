import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { nextSort, sortRowIndices, type TableSort } from "@/lib/sortTable";

function elementsOf(children: ReactNode): ReactElement[] {
  return Children.toArray(children).filter(isValidElement);
}

function isHtml(el: ReactElement, tag: string): boolean {
  return el.type === tag;
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return "";
}

function cellTexts(row: ReactElement): string[] {
  return elementsOf((row.props as { children?: ReactNode }).children)
    .filter((cell) => isHtml(cell, "td") || isHtml(cell, "th"))
    .map((cell) => textOf((cell.props as { children?: ReactNode }).children));
}

export function SortableTable({ children }: { children: ReactNode }) {
  const [sort, setSort] = useState<TableSort | null>(null);
  const parts = elementsOf(children);
  const thead = parts.find((el) => isHtml(el, "thead"));
  const tbody = parts.find((el) => isHtml(el, "tbody"));
  const rest = parts.filter((el) => el !== thead && el !== tbody);

  const headerRow = thead
    ? elementsOf((thead.props as { children?: ReactNode }).children).find((el) => isHtml(el, "tr"))
    : null;
  const headerCells = headerRow
    ? elementsOf((headerRow.props as { children?: ReactNode }).children).filter((el) =>
        isHtml(el, "th"),
      )
    : [];
  const bodyRows = tbody
    ? elementsOf((tbody.props as { children?: ReactNode }).children).filter((el) =>
        isHtml(el, "tr"),
      )
    : [];

  const rowValues = bodyRows.map(cellTexts);
  const order = sort ? sortRowIndices(rowValues, sort.col, sort.dir) : null;
  const orderedRows = order ? order.map((index) => bodyRows[index]) : bodyRows;

  if (!thead || !tbody || headerCells.length === 0) {
    return <table>{children}</table>;
  }

  return (
    <table>
      <thead>
        <tr>
          {headerCells.map((cell, index) => {
            const active = sort !== null && sort.col === index;
            const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
            return (
              <th key={cell.key ?? index} aria-sort={ariaSort}>
                <button
                  type="button"
                  className="md-sort"
                  onClick={() => setSort(nextSort(sort, index))}
                >
                  <span>{(cell.props as { children?: ReactNode }).children}</span>
                  <span className="md-sort-indicator" aria-hidden="true">
                    {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {orderedRows.map((row, index) =>
          cloneElement(row, { key: row.key ?? `row-${order ? order[index] : index}` }),
        )}
      </tbody>
      {rest}
    </table>
  );
}
