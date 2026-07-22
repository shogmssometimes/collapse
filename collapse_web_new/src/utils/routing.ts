// Shared hash-route parsing helper used by both the player app (App.tsx) and
// the GM app (GMApp.tsx). Each app maps the parsed segment/sub pair to its own
// Route union type - this only centralizes the raw hash-parsing logic.
export function parseHashRoute(): { segment: string; sub: string | undefined } {
  if (typeof window === "undefined") return { segment: "", sub: undefined };
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [segment, sub] = hash.split(/[\/?]/);
  return { segment, sub };
}
