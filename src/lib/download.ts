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

/**
 * Jde soubor poslat systémovým „Sdílet" (Disk, e-mail, WhatsApp…)? Jen na dotykovém
 * zařízení – na počítači stačí stažení. Chrome sdílí jen vybrané přípony (ne .json),
 * proto se zkouší textový soubor.
 */
export function canShareTextFile(): boolean {
  try {
    const probe = new File([''], 'probe.txt', { type: 'text/plain' });
    return (
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [probe] }) &&
      window.matchMedia('(pointer: coarse)').matches
    );
  } catch {
    return false;
  }
}

/**
 * Pošle text jako soubor přes systémové sdílení. `false` = uživatel sdílení zavřel.
 * Jiné chyby se propisují dál.
 */
export async function shareTextFile(filename: string, text: string): Promise<boolean> {
  const file = new File([text], filename, { type: 'text/plain' });
  try {
    await navigator.share({ files: [file], title: filename });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw error;
  }
}
