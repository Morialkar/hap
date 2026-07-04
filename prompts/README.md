# Agent Prompt Pack — Heritage Archives Patrimoine (HAP)

One prompt per task, grouped per release file. Each prompt is self-contained: paste it
into a fresh agent session (or point the agent at the file section). Every prompt
assumes the agent can read `~/Literary-Heritage-Archive/PLAN.md` (the architecture
record) — prompts reference its sections instead of duplicating them.

## Files
| File | Contents | Elaboration level |
|---|---|---|
| [R0.md](R0.md) | 9 prompts — heritage groundwork (v2 capsule, goldens, history rewrite, publication) | Fully split |
| [R1.md](R1.md) | 26 prompts — platform core + web app → Eusèbe Parity Milestone | Fully split |
| [R2.md](R2.md) | 3 epic prompts — GPS/maps, report builder, share links | Epic-level (split at gate) |
| [R3.md](R3.md) | 4 epic prompts — Tauri spike, local driver, vault, packaging | Epic-level (split at gate) |
| [R4.md](R4.md) | 4 epic prompts — sync, accounts, backups, hosting/ops | Epic-level (split at gate) |

## Dependency order (R0 + R1)

```
R0 lanes (3 parallel):
  Lane 1: R0-S1 → R0-S2 → R0-S3 → R0-S4        (capsule → characterization)
  Lane 2: R0-S5 → R0-S6 → [needs R0-S1] R0-S7   (safety net → rewrite → publish)
  Lane 3: R0-S8, R0-S9                          (checks + logistics, anytime)

R1 (after R1-A1..A4 foundation):
  R1-B1 → R1-B2 → R1-B3 → R1-B4                 (schema engine)
  R1-C1 [needs B2] → C2 → C3 → C4; C5 after C3  (record engine)
  R1-D1 [needs A2] → D2..D5 [need B/C APIs as noted]; D6 anytime
  R1-E1 [needs B3] → E2, E3 → E4 [needs C1, R0-S3]
  R1-F1 [needs C+E4, R0-S3/S4] → F2 → F3        (parity gate — release exit)
```

## Suggested parallel lanes for R1 (4 agents)
- **Backend A:** B1→B2→B3→B4 then C5
- **Backend B:** C1→C2→C3→C4 then E4
- **Frontend:** D1→D2→D3→D4→D5 (D6 mockup early, with user)
- **Platform/test:** A1→A2→A3→A4, then E1→E2→E3, then F1→F2→F3

## Non-negotiable working agreements (every agent, every prompt)
1. **AFTER discipline:** no feature code before its contract/test exists.
2. `~/Eusebe` is read-only except where an R0 prompt explicitly says otherwise (and
   then only on a fresh clone).
3. The SQL dump (`EUSEBE_DUMP_PATH`) never enters any repo or leaves the machine.
4. Behavior differences vs v2 → entry in `DELTAS.md` before implementing.
5. English identifiers in code; French preserved in UI strings and data.
6. Conventions live in `docs/CONVENTIONS.md` once R1-A4 lands — follow them.
