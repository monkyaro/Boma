/** Mirrors the API's code generation so the form can show the code that will be assigned */
export function nextGeographyCode(existing: string[], prefix = ""): string {
  const numbers = existing
    .filter((code) => code.startsWith(prefix) && /^\d+$/.test(code.slice(prefix.length)))
    .map((code) => Number(code.slice(prefix.length)));
  return prefix + String(Math.max(0, ...numbers) + 1).padStart(2, "0");
}
