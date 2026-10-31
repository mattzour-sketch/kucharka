import { describe, expect, it } from 'vitest';
import { cookLogView } from './cookLogView';

const plain = (text: string) => ({ text, off: false, changed: false, replacedWith: null });

describe('cookLogView', () => {
  it('bez odchylek a se stejnými porcemi: nic k ukázání ani k zopakování', () => {
    expect(cookLogView([plain('800 g brambor'), plain('2 vejce')], 4, 4)).toEqual({
      deviations: [],
      canReplay: false,
    });
  });

  it('jen odchylky: vynecháno, jiné množství, náhrada', () => {
    const off = { text: 'máslo', off: true, changed: false };
    const changed = { text: '300 g mouky', off: false, changed: true };
    const replaced = { text: 'jogurt', off: false, changed: false, replacedWith: 'tvaroh' };
    const view = cookLogView([plain('2 vejce'), off, changed, replaced], 4, 4);
    expect(view.deviations).toEqual([off, changed, replaced]);
    expect(view.canReplay).toBe(true);
  });

  it('jiné porce než recept → zopakovat jde i bez odchylek', () => {
    expect(cookLogView([plain('2 vejce')], 2, 4).canReplay).toBe(true);
  });

  it('recept bez porcí počítá od 1', () => {
    expect(cookLogView([plain('2 vejce')], 1, null).canReplay).toBe(false);
    expect(cookLogView([plain('2 vejce')], 3, null).canReplay).toBe(true);
  });
});
