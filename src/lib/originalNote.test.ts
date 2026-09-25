import { describe, expect, it } from 'vitest';
import { buildOriginalNote, ORIGINAL_NOTE_HEADER, originalNoteText, partitionNotes } from './originalNote';

describe('originalNote', () => {
  it('hlavička je pevný kontrakt (podle ní se poznávají i staré poznámky)', () => {
    expect(ORIGINAL_NOTE_HEADER).toBe('Originál (vložený text):');
  });

  it('round-trip: víceřádkový text i s emoji a zlomky beze změny', () => {
    const pasted = 'The BEST rolls 🔥\n\nIngredients:\n* ½ cup milk\n\n#fyp';
    const body = buildOriginalNote(pasted);
    expect(body.startsWith(`${ORIGINAL_NOTE_HEADER}\n`)).toBe(true);
    expect(originalNoteText(body)).toBe(pasted);
  });

  it('běžná poznámka originálem není', () => {
    expect(originalNoteText('Originál je lepší')).toBeNull();
    expect(originalNoteText('příště míň soli')).toBeNull();
    expect(originalNoteText(ORIGINAL_NOTE_HEADER)).toBeNull();
  });

  it('partitionNotes rozdělí a zachová pořadí', () => {
    const notes = [
      { id: 'a', body: 'míň soli' },
      { id: 'b', body: buildOriginalNote('text') },
      { id: 'c', body: 'víc pepře' },
    ];
    const { own, originals } = partitionNotes(notes);
    expect(own.map((note) => note.id)).toEqual(['a', 'c']);
    expect(originals.map((note) => note.id)).toEqual(['b']);
  });
});
