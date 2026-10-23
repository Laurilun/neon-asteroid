/**
 * Framework-independent simulation primitives. Keeping these outside React
 * makes the rules easy to test and is the first boundary for a future
 * GameWorld extraction.
 */
export const TARGET_FRAME_MS = 1000 / 60;

export const getFrameScale = (previousTime: number | null, currentTime: number): number => {
  const elapsed = previousTime === null ? TARGET_FRAME_MS : currentTime - previousTime;
  // Ignore invalid clock values and prevent a background-tab resume from
  // simulating several seconds in one visual frame.
  return Math.min(3, Math.max(0.25, elapsed / TARGET_FRAME_MS));
};

export const capEntities = <T,>(entities: T[], max: number): T[] =>
  entities.length <= max ? entities : entities.slice(entities.length - max);

/** Advances a timer authored in 60 FPS frame units without relying on exact integer frames. */
export const advancePeriodicTimer = (timer: number, elapsedFrames: number, interval: number) => {
  const total = timer + elapsedFrames;
  return {
    elapsed: total >= interval,
    timer: total % interval,
  };
};
