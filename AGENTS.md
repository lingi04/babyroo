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

## Development workflow

Follow this workflow for development tasks unless the user explicitly requests another approach.

### 1. Plan

- Inspect relevant code and project documentation.
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
