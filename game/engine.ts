/** All gameplay constants are authored in 60 Hz frame units. */
export const TARGET_FRAME_MS = 1000 / 60;
export const MAX_CATCH_UP_STEPS = 5;

/** Bounded catch-up; gameplay time advances only when a step runs. */
export class SimulationClock {
  private previousTime: number | null = null;
  private accumulator = 0;
  private ticks = 0;

  get timeMs(): number { return this.ticks * TARGET_FRAME_MS; }

  resetFrame(): void {
    this.previousTime = null;
    this.accumulator = 0;
  }

  reset(): void {
    this.resetFrame();
    this.ticks = 0;
  }

  advance(now: number, enabled: boolean, step: () => boolean | void): number {
    if (!enabled || !Number.isFinite(now)) {
      this.resetFrame();
      return 0;
    }
    if (this.previousTime === null) {
      this.previousTime = now;
      return 0;
    }
    const elapsed = now - this.previousTime;
    this.previousTime = now;
    if (elapsed < 0) {
      this.accumulator = 0;
      return 0;
    }
    this.accumulator = Math.min(this.accumulator + elapsed, TARGET_FRAME_MS * MAX_CATCH_UP_STEPS);
    let steps = 0;
    while (this.accumulator + 1e-8 >= TARGET_FRAME_MS && steps < MAX_CATCH_UP_STEPS) {
      this.accumulator = Math.max(0, this.accumulator - TARGET_FRAME_MS);
      this.ticks++;
      steps++;
      if (step() === false) {
        this.resetFrame();
        break;
      }
    }
    return steps;
  }
}

/** Stable in-place removal, retaining the newest live entities under the cap. */
export const compactEntities = <T extends { toBeRemoved: boolean }>(entities: T[], max: number): void => {
  let live = 0;
  for (let i = 0; i < entities.length; i++) {
    if (!entities[i].toBeRemoved) entities[live++] = entities[i];
  }
  const keep = Math.max(0, Math.min(live, Math.floor(max)));
  const start = live - keep;
  for (let i = 0; i < keep; i++) entities[i] = entities[start + i];
  entities.length = keep;
};

/** Advances a timer authored in 60 FPS frame units without relying on exact integer frames. */
export const advancePeriodicTimer = (timer: number, elapsedFrames: number, interval: number) => {
  const total = timer + elapsedFrames;
  return {
    elapsed: total >= interval,
    timer: total % interval,
  };
};
