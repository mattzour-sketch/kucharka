/** Nové UUID. crypto.randomUUID je v prohlížeči (secure context) i v Node 19+. */
export function newId(): string {
  return crypto.randomUUID();
}
