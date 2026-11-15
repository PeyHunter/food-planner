// Singular and plural spellings of an ingredient name, so "potatoes" finds "potato" and "berry" finds "berries".
// Only the last word changes: "bay leaves" ↔ "bay leaf". Everything is lower case.

const irregular: Record<string, string> = {
  leaf: "leaves",
  loaf: "loaves",
  half: "halves",
  knife: "knives",
  child: "children",
  person: "people",
  mouse: "mice",
  goose: "geese",
};
const irregularSingular = Object.fromEntries(Object.entries(irregular).map(([one, many]) => [many, one]));

export function nameForms(name: string): string[] {
  const lower = name.trim().toLowerCase();
  const split = lower.lastIndexOf(" ") + 1;
  const head = lower.slice(0, split);
  const word = lower.slice(split);
  const words = new Set([word]);
  if (irregular[word]) words.add(irregular[word]);
  if (irregularSingular[word]) words.add(irregularSingular[word]);
  if (word.length >= 2) {
    words.add(`${word}s`);
    words.add(`${word}es`);
    if (/[^aeiou]y$/.test(word)) words.add(`${word.slice(0, -1)}ies`);
  }
  if (word.length > 4 && word.endsWith("ies")) words.add(`${word.slice(0, -3)}y`);
  if (word.length > 3 && word.endsWith("es")) words.add(word.slice(0, -2));
  if (word.length > 2 && word.endsWith("s") && !word.endsWith("ss")) words.add(word.slice(0, -1));
  return [...words].map((form) => head + form);
}

// Same ingredient by these rules, ignoring capitals.
export const sameIngredient = (a: string, b: string) => nameForms(a).includes(b.trim().toLowerCase());
