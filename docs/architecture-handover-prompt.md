# Reusable architecture review / continuation prompt

Use with a repository-capable coding agent. Recommended here: Astra, High reasoning, one bounded review. The same task definition is usable with Claude or Gemini; do not assume a model ranking from this prompt.

---

You are reviewing Space Ninja as both a children's game designer and a senior browser-game architect. The owner wants an enjoyable, educational space explorer for children aged 5+, on an older Android tablet. Several assistant-driven variants have accumulated. Your objective is a coherent playable experience and an evidence-based repair-versus-rebuild decision, not a list of cosmetic fixes or a fashionable architecture.

Read `docs/product-engine-review-2026-09-23.md` first. Treat it as a hypothesis with source evidence, not authority. Read AGENTS.md and the relevant code. Historical project design constraints may be challenged; the owner explicitly authorized a fresh plan. Preserve existing work, privacy, honest scientific/media claims and basic child accessibility. This is review/planning permission, not permission to delete variants, migrate engines, deploy or perform a full rewrite.

First establish the exact baseline: current checkout, branch, HEAD, dirty/untracked files, other registered worktrees and deployed revision if verifiable. Preserve distinctions between root adventure, Moon/space trial, travel-hardening and the dirty unified version. Do not accidentally review only the older root or run its tests across nested repositories. Do not overwrite uncommitted work. Ask one early clarification if the intended playable version remains uncertain; continue independent inspection meanwhile.

Answer these questions in order:

1. What should a child do, feel and learn in the first five minutes? Propose one primary fantasy, a short loop and observable success criteria that do not require reading. Explain the roles of steering, destination assistance, discoveries, narration and optional memories. Identify assumptions requiring tablet/child observation.
2. What actually happens now? Trace startup → first touch → journey → exploration → discovery → return → repeat, plus modal/background/crash paths. Inspect real input and screenshots. Distinguish source findings, observed runtime behavior and untested hypotheses.
3. Which existing systems deserve preservation? Audit game-state ownership, camera/input ownership, timing, world coordinates/scale, content/media identity, persistence, asset lifetime, offline updates and target-device cost. Follow the ownership paths; do not base conclusions on file lengths alone.
4. Is the best option focused repair, experience-layer reconstruction, or a full rebuild? Compare migration cost, likely regressions, uncertainty and child-facing benefit. Keep the current engine unless a demonstrated need defeats it. Define what evidence would reverse the recommendation.
5. What is the smallest Earth-to-Moon outing that proves the answer? Define module ownership, acceptance gates, retained systems and an ordered implementation plan. Avoid building a generic engine before proving this slice.

Pay particular attention to whether the default explorer actually uses the project's narration, discovery persistence and educational activities; whether a visible ship exists during claimed piloting; whether the state coordinator controls effects or merely records labels; and whether tested lifecycle fixes survive across branches. Check content/coordinate truth independently from navigation staging. Do not preserve quota/hidden-target design assumptions solely because old tests assert them.

Use one agent unless I explicitly request delegation. Read selected core files and dependencies instead of dumping the repository. Run bounded, relevant checks once; capture and inspect representative screenshots if browser execution is available. Do not run every variant's exhaustive browser suite merely to recommend a direction. Do not fix unrelated issues during the review.

Deliver:

- A decisive recommendation with confidence, strongest counterargument and reversal criteria.
- At most five high-impact findings, each with source/visual evidence and child-facing consequence.
- A one-page proposed product contract and a small ownership diagram/table.
- Keep/replace/retire decisions and a phased plan with pass/fail gates and rollback points.
- Exact tested baseline/results and what still requires a device or child.
- One bounded implementation handoff suitable for a less expensive model, with scope, files, interfaces, acceptance checks and explicit exclusions.

If continuing the September 23 review rather than independently auditing it, verify changed evidence and execute only the next agreed gate. Do not regenerate the entire review or silently turn this into a whole-game rewrite.

---

## First implementation handoff after baseline selection

Implement only the agreed Earth-to-Moon vertical slice in the selected canonical checkout. Preserve the saved baseline and untracked work before editing. Reuse Stage, bodies, authored assets, matching narration, discovery IDs and tested lifecycle behavior. Establish one experience controller and one camera owner. Provide visible movement/stop feedback, optional destination help, one discoverable real subject, photograph plus matching short explanation, a remembered discovery and a dependable return. Keep settings separate from progress. Support interrupted input, modal pause, background/resume and reduced motion. Do not add worlds, replace the engine, redesign every menu or merge all historical variants. Run typecheck, relevant unit tests and real-pointer browser flows; inspect tablet/phone/short-landscape screenshots. Report the exact diff, acceptance results and remaining tablet/child observations. Stop at this gate before expanding scope.
