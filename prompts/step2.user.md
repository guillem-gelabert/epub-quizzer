Task:
Generate {{QUESTION_COUNT}} multiple-choice comprehension questions from the FACTS below.

Rules:
- Use ONLY the facts provided (by id).
- Each question must have EXACTLY 3 answer choices (A, B, C).
- EXACTLY ONE choice must be correct.
- Wrong choices must be plausible but contradicted or unsupported by the facts.
- Provide correct_choice as "A" or "B" or "C".
- Evidence must copy the evidence quote(s) from the referenced facts.

Output JSON only.

FACTS:
{{FACTS_JSON}}

