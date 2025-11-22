# NFR Design

## Prerequisites
- NFR Requirements Assessment must be complete for the unit
- NFR requirements artifacts must be available
- Execution plan must indicate NFR Design stage should execute

## Overview
Incorporate NFR requirements into unit design using patterns and logical components.

## Steps to Execute

### Step 1: Analyze NFR Requirements
- Read NFR requirements from `aidlc-docs/construction/{unit-name}/nfr-requirements/`
- Understand scalability, performance, availability, security needs

### Step 2: Create NFR Design Plan
- Generate plan with checkboxes [] for NFR design
- Focus on design patterns and logical components
- Each step should have a checkbox []

### Step 3: Generate Context-Appropriate Questions
**DIRECTIVE**: Analyze the NFR requirements to generate ONLY questions relevant to THIS specific unit's NFR design. Use the categories below as inspiration, NOT as a mandatory checklist. Skip entire categories if not applicable.

- EMBED questions using [Answer]: tag format
- Focus on ambiguities and missing information specific to this unit
- Generate questions only where user input is needed for pattern and component decisions

**Example question categories** (adapt as needed):
- **Resilience Patterns** - Only if fault tolerance approach needs clarification
- **Scalability Patterns** - Only if scaling mechanisms are unclear
- **Performance Patterns** - Only if performance optimization strategy is ambiguous
- **Security Patterns** - Only if security implementation approach needs input
- **Logical Components** - Only if infrastructure components (queues, caches, etc.) need clarification

### Step 4: Store Plan
- Save as `aidlc-docs/construction/plans/{unit-name}-nfr-design-plan.md`
- Include all [Answer]: tags for user input

### Step 5: Collect and Analyze Answers
- Wait for user to complete all [Answer]: tags
- Review for vague or ambiguous responses
- Add follow-up questions if needed

### Step 6: Generate NFR Design Artifacts
- Create `aidlc-docs/construction/{unit-name}/nfr-design/nfr-design-patterns.md`
- Create `aidlc-docs/construction/{unit-name}/nfr-design/logical-components.md`

### Step 7: Log Approval and Update Progress
- Log approval in audit.md with timestamp
- Wait for explicit user approval
- Mark NFR Design stage complete in aidlc-state.md
