/** Stáhne textový obsah jako soubor (bez serveru, čistě v prohlížeči). */
export function downloadTextFile(
  filename: string,
  text: string,
  type = 'application/json',
): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
