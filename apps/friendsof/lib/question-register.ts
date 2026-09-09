export interface QuestionRegisterItem {
  id: string;
  question: string;
  metadata: readonly { label: string; value: string }[];
}

export interface QuestionRegisterSection {
  id: string;
  title: string;
  leadMarkdown: string;
  trailingMarkdown: string;
  questions: readonly QuestionRegisterItem[];
}

export interface QuestionRegisterDocument {
  prefixMarkdown: string;
  suffixMarkdown: string;
  sections: readonly QuestionRegisterSection[];
  questionCount: number;
}

interface HeadingBoundary { id: string; title: string; start: number; contentStart: number }

/**
 * Extracts A–G GFM question tables without changing the stored Markdown.
 * Returns null for ordinary documents so they continue through the normal reader.
 */
export function parseQuestionRegister(markdown: string): QuestionRegisterDocument | null {
  const normalized = markdown.replace(/\r\n?/gu, "\n");
  const lines = normalized.split("\n");
  const headings: HeadingBoundary[] = [];

  for (let index = 0; index < lines.length; index++) {
    const match = /^##\s+([A-G])\.\s+(.+?)\s*$/u.exec(lines[index] ?? "");
    if (match) headings.push({ id: match[1]!, title: match[2]!, start: index, contentStart: index + 1 });
  }
  if (headings.length === 0) return null;

  const sections: QuestionRegisterSection[] = [];
  let lastQuestionTableEnd = -1;
  for (let headingIndex = 0; headingIndex < headings.length; headingIndex++) {
    const heading = headings[headingIndex]!;
    const nextHeading = findNextH2(lines, heading.contentStart);
    const sectionEnd = nextHeading < 0 ? lines.length : nextHeading;
    const table = findQuestionTable(lines, heading.contentStart, sectionEnd);
    if (!table) continue;

    sections.push({
      id: heading.id,
      title: heading.title,
      leadMarkdown: trimBlankLines(lines.slice(heading.contentStart, table.headerIndex).join("\n")),
      trailingMarkdown: trimBlankLines(lines.slice(table.endIndex, sectionEnd).join("\n")),
      questions: table.questions,
    });
    lastQuestionTableEnd = Math.max(lastQuestionTableEnd, sectionEnd);
  }

  const questionCount = sections.reduce((sum, section) => sum + section.questions.length, 0);
  if (questionCount === 0) return null;

  const firstSectionStart = headings.find((heading) => sections.some((section) => section.id === heading.id))?.start ?? 0;
  return {
    prefixMarkdown: omitFirstH1(trimBlankLines(lines.slice(0, firstSectionStart).join("\n"))),
    suffixMarkdown: trimBlankLines(lines.slice(lastQuestionTableEnd).join("\n")),
    sections,
    questionCount,
  };
}

function findQuestionTable(
  lines: readonly string[],
  start: number,
  end: number,
): { headerIndex: number; endIndex: number; questions: QuestionRegisterItem[] } | null {
  for (let index = start; index + 2 < end; index++) {
    const headers = parseGfmRow(lines[index] ?? "");
    if (!headers || headers.length < 2 || headers[0]?.trim().toLowerCase() !== "id" || headers[1]?.trim().toLowerCase() !== "question") continue;
    const delimiter = parseGfmRow(lines[index + 1] ?? "");
    if (!delimiter || delimiter.length !== headers.length || delimiter.some((cell) => !/^:?-{3,}:?$/u.test(cell.trim()))) continue;

    const questions: QuestionRegisterItem[] = [];
    let rowIndex = index + 2;
    while (rowIndex < end) {
      const cells = parseGfmRow(lines[rowIndex] ?? "");
      if (!cells || cells.length < 2) break;
      const id = cells[0]!.trim();
      if (!/^Q\d{2,}$/u.test(id)) break;
      questions.push({
        id,
        question: cells[1]!.trim(),
        metadata: headers.slice(2).map((label, metadataIndex) => ({
          label: label.trim(),
          value: (cells[metadataIndex + 2] ?? "").trim(),
        })),
      });
      rowIndex++;
    }
    if (questions.length > 0) return { headerIndex: index, endIndex: rowIndex, questions };
  }
  return null;
}

/** GFM row splitter supporting escaped pipes and pipes inside inline-code spans. */
export function parseGfmRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells: string[] = [];
  let cell = "";
  let escaped = false;
  let codeFenceLength = 0;

  for (let index = 1; index < trimmed.length - 1; index++) {
    const character = trimmed[index]!;
    if (escaped) {
      cell += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      cell += character;
      escaped = true;
      continue;
    }
    if (character === "`") {
      let run = 1;
      while (trimmed[index + run] === "`") run++;
      if (codeFenceLength === 0) codeFenceLength = run;
      else if (codeFenceLength === run) codeFenceLength = 0;
      cell += "`".repeat(run);
      index += run - 1;
      continue;
    }
    if (character === "|" && codeFenceLength === 0) {
      cells.push(unescapeCell(cell));
      cell = "";
      continue;
    }
    cell += character;
  }
  cells.push(unescapeCell(cell));
  return cells;
}

function unescapeCell(value: string): string {
  return value.replace(/\\\|/gu, "|").replace(/\\\\/gu, "\\");
}
function findNextH2(lines: readonly string[], start: number): number {
  for (let index = start; index < lines.length; index++) {
    if (/^##\s+/u.test(lines[index] ?? "")) return index;
  }
  return -1;
}
function omitFirstH1(value: string): string {
  const lines = value.split("\n");
  const headingIndex = lines.findIndex((line) => /^#\s+\S/u.test(line));
  if (headingIndex >= 0) lines.splice(headingIndex, 1);
  return trimBlankLines(lines.join("\n"));
}
function trimBlankLines(value: string): string {
  return value.replace(/^(?:[ \t]*\n)+|(?:\n[ \t]*)+$/gu, "");
}
