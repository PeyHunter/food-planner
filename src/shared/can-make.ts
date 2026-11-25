/** A recipe found on the web for "What can I make?". `why` says what it uses from the cook's list; `missing` is what it still needs. */
export type Idea = { title: string; url: string; site: string; why: string; missing: string[] };
