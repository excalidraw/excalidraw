---
name: start-enhancement
description: Start development of a selected enhancement by validating the requirements, creating a feature branch, exploring the relevant codebase, and preparing an implementation plan.
disable-model-invocation: true
---

# Start Enhancement

Use this skill after the developer has selected an enhancement and its requirements have already been retrieved.

The purpose of this skill is to prepare the enhancement for implementation safely and consistently.

Do not immediately start coding.

The workflow should establish:

1. the feature requirements
2. a safe Git branch
3. relevant codebase context
4. likely areas of impact
5. an implementation plan
6. any required clarification from the developer

---

# 1. Confirm feature context

Identify the enhancement selected earlier in the conversation.

Review the available:

- feature name
- objective
- requirements
- acceptance criteria
- constraints
- dependencies

Do not retrieve a different enhancement unless explicitly requested.

Before proceeding, briefly summarise:

## Enhancement
<feature name>

## Goal
<short description>

## Key acceptance criteria
- criterion
- criterion
- criterion

If critical feature context is missing, retrieve the missing information from the relevant connected source where possible.

Do not invent requirements.

---

# 2. Inspect the Git repository

Before making any changes, inspect the repository.

Determine:

- current Git branch
- working tree status
- whether there are uncommitted changes
- likely base branch
- whether the repository is currently in a safe state for feature development

Use appropriate Git commands where required.

---

# 3. Protect existing work

If there are uncommitted changes:

- do not discard them
- do not overwrite them
- do not automatically stash them
- do not switch branches if doing so could affect them

Explain the situation to the developer before continuing.

Never use destructive Git operations to make the working tree clean.

---

# 4. Create the feature branch

If the repository is in a safe state, create a dedicated feature branch.

Generate the branch name from the selected enhancement.

Use:

feature/<short-kebab-case-feature-name>

Examples:

feature/category-filtering

feature/favourite-innovations

feature/improved-search

feature/recently-viewed

Keep branch names:

- short
- descriptive
- lowercase
- kebab-case

Create and switch to the branch.

For example:

git switch -c feature/category-filtering

Confirm the active branch after creation.

Never develop directly on:

- main
- master

---

# 5. Explore the relevant codebase

Before writing code, investigate how the existing application works.

Identify the code relevant to the selected enhancement.

Explore:

- entry points
- relevant components
- services
- APIs
- models or schemas
- state management
- utility functions
- existing tests
- related features
- configuration
- data flow

Use semantic codebase search rather than relying only on filename searches.

The objective is to understand how the requested capability fits into the existing architecture.

---

# 6. Explain the existing implementation

Before proposing changes, give the developer a concise explanation of the relevant codebase.

Include:

## Relevant architecture

Explain how the affected functionality currently works.

## Important files

List the most important files and briefly explain their purpose.

Example:

- `src/components/InnovationList.tsx` — renders the innovation list
- `src/hooks/useInnovations.ts` — retrieves innovation data
- `src/services/innovationService.ts` — communicates with the backend

## Data flow

Explain the relevant flow.

For example:

UI
→ state
→ application logic
→ service
→ API/data source

## Likely areas of change

Identify which components are likely to require modification.

## Potential risks

Highlight:

- regression areas
- data compatibility issues
- existing assumptions
- dependencies
- edge cases

This stage should help a developer unfamiliar with the repository understand the relevant implementation quickly.

---

# 7. Compare requirements with the codebase

Evaluate the requested enhancement against the existing implementation.

For each major requirement determine whether it:

- already exists
- requires modification
- requires new functionality
- introduces ambiguity
- conflicts with existing behaviour

Do not make code changes yet.

---

# 8. Identify clarification questions

Determine whether any product or implementation decisions require human input.

Ask only questions that materially affect the implementation.

Examples include:

- single-select versus multi-select behaviour
- persistence expectations
- error behaviour
- backwards compatibility
- UX behaviour
- permissions
- performance expectations

Do not ask questions whose answers can reasonably be determined from:

- the existing codebase
- the Notion requirements
- existing project conventions

Prefer resolving technical details from context before asking the developer.

---

# 9. Prepare the implementation plan

Create a structured implementation plan.

The plan should include:

## Proposed approach

Explain the recommended implementation strategy.

## Files to modify

List the expected files and why each will change.

## New files

Identify any new files or components required.

## Implementation steps

Provide an ordered sequence.

For example:

1. Extend the feature state model.
2. Add category filter controls.
3. Implement filtering logic.
4. Normalise category values.
5. Preserve filter state.
6. Add tests.
7. Validate existing search behaviour.

## Testing strategy

Describe:

- unit tests
- integration tests
- manual validation
- regression areas

## Risks

Highlight implementation or compatibility risks.

---

# 10. Stop before implementation

Once the implementation plan is ready:

- present the plan to the developer
- surface any remaining clarification questions
- wait for approval before editing application code

Do not automatically begin implementation as part of this skill.

The developer should retain a clear approval checkpoint between planning and implementation.

---

# Git guardrails

Always follow these rules:

- Never develop directly on `main` or `master`.
- Never discard uncommitted changes.
- Never run `git reset --hard`.
- Never force-push.
- Never overwrite another branch.
- Never merge automatically.
- Never delete branches automatically.
- Never commit automatically unless explicitly requested.
- Never push automatically unless explicitly requested.
- Never create a pull request unless explicitly requested.
- Always confirm the active feature branch before implementation begins.

---

# Development guardrails

- Do not modify application code before the implementation plan has been reviewed.
- Base proposed changes on the actual repository.
- Do not invent files, APIs, architecture, or requirements.
- Prefer established patterns already used by the project.
- Clearly distinguish confirmed facts from assumptions.
- Keep the implementation proportional to the enhancement.
- Avoid unnecessary refactoring unrelated to the selected feature.

---

# Completion

This skill is complete when:

1. the selected enhancement has been confirmed
2. a safe feature branch has been created
3. the relevant codebase has been explored
4. the developer understands where the functionality lives
5. an implementation plan has been produced
6. clarification questions have been answered or surfaced
7. no implementation has yet begun

Finish by telling the developer that the enhancement is ready for implementation.
