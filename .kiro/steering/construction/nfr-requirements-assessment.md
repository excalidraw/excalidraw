# NFR Requirements Assessment

## Prerequisites
- Functional Design must be complete for the unit
- Unit functional design artifacts must be available
- Execution plan must indicate NFR Requirements Assessment stage should execute

## Overview
Determine non-functional requirements for the unit and make tech stack choices.

## Steps to Execute

### Step 1: Analyze Functional Design
- Read functional design artifacts from `aidlc-docs/construction/{unit-name}/functional-design/`
- Understand business logic complexity and requirements

### Step 2: Create NFR Requirements Plan
- Generate plan with checkboxes [] for NFR assessment
- Focus on scalability, performance, availability, security
- Each step should have a checkbox []

### Step 3: Generate Context-Appropriate Questions
**DIRECTIVE**: Analyze the functional design to generate ONLY questions relevant to THIS specific unit's NFR needs. Use the categories below as inspiration, NOT as a mandatory checklist. Skip entire categories if not applicable.

- EMBED questions using [Answer]: tag format
- Focus on ambiguities and missing information specific to this unit
- Generate questions only where user input is needed for NFR and tech stack decisions

**Example question categories** (adapt as needed):
- **Scalability Requirements** - Only if load expectations or scaling approach is unclear
- **Performance Requirements** - Only if response time or throughput needs clarification
- **Availability Requirements** - Only if uptime or disaster recovery is ambiguous
- **Security Requirements** - Only if data protection or compliance needs are unclear
- **Tech Stack Selection** - Only if technology choices need user input

### Step 4: Store Plan
- Save as `aidlc-docs/construction/plans/{unit-name}-nfr-requirements-plan.md`
- Include all [Answer]: tags for user input

### Step 5: Collect and Analyze Answers
- Wait for user to complete all [Answer]: tags
- Review for vague or ambiguous responses
- Add follow-up questions if needed

### Step 6: Generate NFR Requirements Artifacts
- Create `aidlc-docs/construction/{unit-name}/nfr-requirements/nfr-requirements.md`
- Create `aidlc-docs/construction/{unit-name}/nfr-requirements/tech-stack-decisions.md`

### Step 7: Log Approval and Update Progress
- Log approval in audit.md with timestamp
- Wait for explicit user approval
- Mark NFR Requirements Assessment stage complete in aidlc-state.md
