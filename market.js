// Mercado definido exclusivamente pela Proforma, sem depender do campo histórico.
export const marketOf = p => /RJ|AR/i.test(String(p?.proforma ?? '')) ? 'ME' : 'MI';
export const marketLabel = m => m === 'ME' ? 'ME — Mercado externo' : 'MI — Mercado interno';
