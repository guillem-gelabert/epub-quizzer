Task:
1) Extract 3–6 key facts important for comprehension of the WINDOW.
2) Propose a compact state_update (entities + optional summary) for future reference resolution.

Rules for facts:
- Each fact MUST be directly supported by the WINDOW.
- Evidence MUST be an exact quote (<= 25 words) from the WINDOW.
- You MAY use STATE only to resolve ambiguous references (e.g., who "she" refers to), but MUST NOT introduce facts from STATE.
- If ambiguity remains, keep the fact neutral and mention ambiguity in notes.

Rules for state_update:
- entities_add: include only NEW or newly-disambiguated entities introduced/clarified in the WINDOW.
- Each entity description must be 3–8 words.
- summary_append: OPTIONAL; 1–2 sentences summarizing the WINDOW only (no spoilers).

Output JSON only matching the schema you were given.

STATE (optional hints; NOT evidence):
{{STATE_JSON}}

WINDOW:
{{WINDOW_TEXT}}

