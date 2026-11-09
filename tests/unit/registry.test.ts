import { describe, expect, it } from 'vitest';
import { sims, subtopics } from '../../src/app/registry';

describe('simulation catalogue', () => {
  it('has the 84 planned simulations with unique ids', () => {
    expect(sims.length).toBe(84);
    expect(new Set(sims.map((s) => s.id)).size).toBe(sims.length);
  });
  it('every simulation belongs to a syllabus subtopic matching its id', () => {
    const codes = new Set(subtopics.map((s) => s.code));
    for (const s of sims) {
      expect(codes.has(s.code)).toBe(true);
      expect(s.id.slice(0, 2)).toBe(s.code.replace('.', '').toLowerCase());
    }
  });
  it('HL-only subtopics contain only HL simulations', () => {
    for (const st of subtopics.filter((x) => x.hlOnly)) {
      for (const s of sims.filter((x) => x.code === st.code)) expect(s.hl).toBe('full');
    }
  });
});
