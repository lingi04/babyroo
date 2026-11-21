# Project instructions

## Communication

- Always answer in English unless the user explicitly requests another language.
- Ask clarifying questions when ambiguous requirements affect scope or behavior.
- Keep progress updates concise and easy to review on a phone.
- Bundle related questions and provide a recommended option when asking for a decision.
- Make the next required user action clear.

## Model selection and usage

- Prefer GPT-6.1 Sol with Medium reasoning for planning, plan review, and larger implementation tasks.
- Prefer GPT-6.1 Terra with Medium reasoning for scoped implementation and routine verification fixes.
- Prefer Luna with Low reasoning for small text edits.
- Consider higher reasoning effort or a more capable model when task complexity or unresolved failures justify it.
- Use models and reasoning levels available in the current client and account.
- These preferences guide model selection. The active model and reasoning level are controlled by the client or runtime settings.
- When a model change would materially help, suggest it briefly at a natural stage boundary and continue authorized work with the active model unless the user asks to pause.
- Keep tool output and reports focused on the task. Reuse relevant context and avoid repeating checks unless changes or failures justify them.
- Keep a `Model usage` table in each task's plan file with columns for workflow stage, agent, plugin / skill used, model used, reasoning level, and evidence. Record the Plan, Review the plan, Implement, and Verify stages as they are performed; mark stages that have not started as `Pending`.
- Use only model names and reasoning levels confirmed by runtime metadata or client settings supplied by the user. Record the source in the evidence column. If either value cannot be confirmed, write `Unknown` for that value; do not infer it from the preferences above or interrupt work to obtain it.
- Update the table when the model or reasoning level changes within a stage, retaining earlier entries so the record shows all confirmed settings used during that stage.

### Agent assignments

- The main agent writes the plan and implements the approved changes.
- Delegate plan review to a separate sub-agent. Record its findings and how the main agent addressed them.
- Delegate verification to a separate sub-agent. Record the checks it ran, their results, and any remaining gaps.
- Identify the intended agent and any assigned skill in the plan before each stage. In the usage table, record the actual main agent or sub-agent task name and its contribution. Give each contributor a separate row.

### Plugin and skill assignments

- For UI design reviews, use Product Design’s audit skill to compare the current screen and the proposed design. Tie findings to visible evidence.
- When the user requests a Codex Council review, use the Codex Council skill. Present the panel and estimate, then obtain acceptance before dispatch.
- Include the assigned skill and expected evidence in each delegated task. Record the skills actually followed and any plugin tool calls and outcomes. Identify evidence reported by a sub-agent.
- For each stage, enter `None` if no plugin or skill was used, `Unknown` if usage cannot be established, and `Pending` until the stage starts. Record blocked attempts in the evidence column.
- If a required plugin or skill is unavailable, record the blocker and ask before substituting another review method.

## Design quality and visual review

- Before implementing a UI change, share an image of the current UI and a mockup image of the proposed UI with the user during plan review. Label them clearly and place them side by side when practical. Show the same screen and interaction state at the same display size so the user can compare them before approving implementation. Use a screenshot for the current UI when available, and clearly label any faithful reconstruction as a preview.
- Take responsibility for reviewing whether UI changes look aesthetically polished and are intuitively understandable to a person using the app. Perform this review proactively without waiting for the user to request it.
- Evaluate visual balance, spacing, alignment, typography, contrast, and consistency with the surrounding interface. For icons, also check recognizability, stroke weight, and optical size as a set.
- Assess whether the intended users can understand each symbol and action in context. Choose familiar visual conventions and use labels where they help comprehension.
- Inspect rendered UI at its actual display size in the surrounding screen, including relevant selected, unselected, and interaction states. Use a simulator, device, screenshot, or faithful preview, and distinguish previews from the running app when reporting results.
- Fix visual and comprehension issues found during review within the approved scope, then inspect the revised result again before delivery.
- Include visual quality and intuitive meaning in acceptance criteria for design work. Provide a screenshot or preview when available and briefly report what was visually checked.
- If rendering is blocked, make a useful preview when feasible and clearly state any remaining visual verification gap. Keep visual approval pending until the rendered result has been inspected.

## Development workflow

Follow this workflow for development tasks unless the user explicitly requests another approach.

### 1. Plan

- Inspect relevant code and project documentation.
- Before writing a plan, choose and read the appropriate reusable skill, then follow it for the requirements interview: use `.agents/skills/grill-with-docs/SKILL.md` when the plan needs to be checked against existing domain terminology and documented decisions, or `.agents/skills/grill-me/SKILL.md` for other plans.
- Before writing the plan, interview the user to make each feature's requirements concrete. Ask focused questions grounded in the feature and repository, covering applicable areas such as target users and scenarios, functional behavior and user flows, visual design and interaction details, data and integrations, states and edge cases, permissions, errors, and constraints.
- Ask about one feature or closely related decision group at a time. Avoid generic or already-answered questions; use follow-ups to resolve important ambiguity, and offer a recommended option when there are reasonable alternatives.
- Do not write the plan until the material design and behavior decisions are clear. If the user declines to answer or delegates a decision, state a reasonable assumption in the plan rather than presenting it as confirmed.
- Save the plan to `docs/plans/<scope>-<task-name>.md`, using a scope prefix such as `admin-`, `server-`, or `android-` that identifies the affected application or subsystem.
- Include the agreed requirements and assumptions, feature-specific acceptance criteria, implementation steps, and verification steps.

### 2. Review the plan

- Check the plan against existing code and project conventions.
- Resolve gaps and update the plan.
- Present a concise summary and any decisions requiring user input.
- Wait for explicit approval before implementation. Approval already given in the conversation applies to the approved scope.

### 3. Implement

- Implement the approved plan.
- Make routine implementation decisions autonomously.
- Ask before making material changes to approved scope or behavior.
- Keep the plan updated as work progresses.
- Continue through verification once implementation is authorized.

### 4. Verify

- Run relevant tests, type checks, linting, and builds available in the repository.
- Review the diff against each acceptance criterion.
- Fix failures caused by the changes and repeat relevant checks.
- For UI changes, provide screenshots or a preview when available.
- Report completed work, verification results, and anything unverified.
