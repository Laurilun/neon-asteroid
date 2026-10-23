import { describe, expect, it } from 'vitest';
import { advancePeriodicTimer, capEntities, getFrameScale } from './engine';

describe('getFrameScale', () => {
  it('treats the first tick and a 60 FPS tick as one simulation frame', () => {
    expect(getFrameScale(null, 100)).toBe(1);
    expect(getFrameScale(100, 100 + 1000 / 60)).toBeCloseTo(1);
  });

  it('scales lower refresh rates and clamps background-tab gaps', () => {
    expect(getFrameScale(0, 1000 / 30)).toBeCloseTo(2);
    expect(getFrameScale(0, 10_000)).toBe(3);
  });
});

describe('capEntities', () => {
  it('retains the newest items and does not allocate below the cap', () => {
    const underCap = [1, 2];
    expect(capEntities(underCap, 3)).toBe(underCap);
    expect(capEntities([1, 2, 3, 4], 2)).toEqual([3, 4]);
  });
});

describe('advancePeriodicTimer', () => {
  it('fires after a fractional frame step crosses its interval', () => {
    expect(advancePeriodicTimer(3.75, 0.5, 4)).toEqual({ elapsed: true, timer: 0.25 });
  });
});
