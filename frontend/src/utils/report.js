const SECTION_PATTERNS = [
  { key: "summary", labels: ["summary", "overview", "day summary"] },
  { key: "wins", labels: ["wins", "highlights", "achievements"] },
  { key: "risks", labels: ["risks", "concerns", "challenges"] },
  { key: "missed", labels: ["missed opportunities", "missed", "missed visits"] },
  { key: "tomorrow", labels: ["tomorrow", "tomorrow's focus", "next steps", "recommendations"] },
  { key: "closing", labels: ["closing", "closing note", "final note"] },
];

export function parseReport(text = "") {
  if (!text.trim()) {
    return { sections: [], fallback: "" };
  }

  const lines = text.split("\n");
  const sections = [];
  let current = { key: "summary", title: "Summary", content: [] };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase().replace(/[*#:_-]/g, "").trim();
    const matched = SECTION_PATTERNS.find((pattern) =>
      pattern.labels.some((label) => lower.startsWith(label) || lower === label)
    );

    if (matched && trimmed.length < 60) {
      if (current.content.length > 0) {
        sections.push({ ...current, content: current.content.join("\n") });
      }
      current = {
        key: matched.key,
        title: trimmed.replace(/^[*#]+\s*/, ""),
        content: [],
      };
      continue;
    }

    current.content.push(trimmed);
  }

  if (current.content.length > 0) {
    sections.push({ ...current, content: current.content.join("\n") });
  }

  if (sections.length === 0) {
    return { sections: [{ key: "summary", title: "Summary", content: text }], fallback: "" };
  }

  return { sections, fallback: "" };
}
