// Prefer the market explicitly saved in the process. Infer from the proforma only for legacy rows without a valid selection.
export const marketOf = p => {
  const saved = String(p?.mercado ?? "").trim().toUpperCase();
  if (saved === "MI" || saved === "ME") return saved;
  return /RJ|AR/i.test(String(p?.proforma ?? "")) ? "ME" : "MI";
};
export const marketLabel = m => m === "ME" ? "ME — Mercado externo" : "MI — Mercado interno";
