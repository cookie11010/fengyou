/** Fills "{name}" placeholders in translated strings: fill("Hi {name}", { name: "Mei" }). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}
