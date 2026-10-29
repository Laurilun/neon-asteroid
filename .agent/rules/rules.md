---
trigger: always_on
---
# Neon Void project rules

- Work on the latest `main` unless the user explicitly directs otherwise. Fetch and inspect branch ancestry and the working tree first. Preserve uncommitted and unrelated work; investigate divergence rather than overwriting it.
- GitHub is the continuously maintained source of truth. A completed development task normally includes implementation, relevant validation, descriptive commits explaining what changed and why, and an automatic push to `origin/main`. No separate push request is needed.
- Group completed, coherent work into logical commits. Substantial milestones may use several commits; do not commit each tiny edit separately or publish known broken/incomplete work.
- Before pushing, run tests, type checks, and builds proportional to the change. For engine changes use `npm test`, `npm run typecheck`, and `npm run build`; use `npm.cmd` on Windows if PowerShell blocks the npm script shim.
- Never force-push, discard local work, or rewrite history without explicit authorization. Report permissions, divergence, or other push blockers honestly, and report the resulting commit hash and whether publication succeeded.
- `paska` is retained as a historical branch. The New Era baseline (`7132f4a`, October 23, 2026, `start new era`) was safely fast-forwarded into GitHub's default `main`. Do not delete `paska` automatically.
- Preserve the Canvas 2D / React / Vite / TypeScript stack, screen wrapping, core controls, progression, and enemy mechanics unless a task explicitly authorizes changes. Mass & Mayhem establishes the procedural industrial gunship/material art direction and momentum/cannon model. Avoid unrelated dependency upgrades or balance changes.
- Gameplay constants use 60 Hz frame units. Extracted systems run once per fixed tick; rendering must not advance gameplay rules. Keep new engine logic framework independent and test representative behavior.
- Check for an existing server on port 3000/3001 before starting another; start one when necessary. Use existing browser testing capabilities when available and report verification gaps.
- Explain decisions plainly and challenge questionable assumptions; the user is not a professional programmer.
