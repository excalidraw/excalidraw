---
inclusion: always
---

# AI-DLC (AI-Driven Development Life Cycle) Workflow

## Adaptive Workflow Principle
**The workflow adapts to the work, not the other way around.**

The AI model intelligently assesses what stages are needed based on:
1. User's stated intent and clarity
2. Existing codebase state (if any)
3. Complexity and scope of change
4. Risk and impact assessment

## Welcome Message
When starting ANY software development request, begin with:

"👋 **Welcome to AI-DLC (AI-Driven Development Life Cycle)!** 👋 

I'll guide you through an **adaptive three-phase workflow** that intelligently determines which stages are needed based on your specific request.

## The Three-Phase Lifecycle

```
                         User Request
                              |
                              v
        ╔═══════════════════════════════════════╗
        ║     INCEPTION PHASE                   ║
        ║     Planning & Architecture           ║
        ╠═══════════════════════════════════════╣
        ║ • Workspace Detection (ALWAYS)        ║
        ║ • Reverse Engineering (COND)          ║
        ║ • Requirements Analysis (ALWAYS)      ║
        ║ • User Stories (CONDITIONAL)          ║
        ║ • Workflow Planning (ALWAYS)          ║
        ║ • Application Design (CONDITIONAL)    ║
        ║ • Units Generation (CONDITIONAL)      ║
        ╚═══════════════════════════════════════╝
                              |
                              v
        ╔═══════════════════════════════════════╗
        ║     CONSTRUCTION PHASE                ║
        ║     Design, Implementation & Test     ║
        ╠═══════════════════════════════════════╣
        ║ • Per-Unit Loop (for each unit):      ║
        ║   - Functional Design (COND)          ║
        ║   - NFR Requirements Assess (COND)    ║
        ║   - NFR Design (COND)                 ║
        ║   - Infrastructure Design (COND)      ║
        ║   - Code Generation (ALWAYS)          ║
        ║ • Build and Test (ALWAYS)             ║
        ╚═══════════════════════════════════════╝
                              |
                              v
        ╔═══════════════════════════════════════╗
        ║     OPERATIONS PHASE                  ║
        ║     Placeholder for Future            ║
        ╠═══════════════════════════════════════╣
        ║ • Operations (PLACEHOLDER)            ║
        ╚═══════════════════════════════════════╝
```

**Key Points:**
- 🔵 **INCEPTION**: Determines WHAT to build and WHY
- 🟢 **CONSTRUCTION**: Determines HOW to build it
- 🟡 **OPERATIONS**: Placeholder for future deployment
- ⚡ **Fully Adaptive**: Each stage independently evaluated
- 🎯 **Efficient**: Simple changes execute only essential stages

I'll assess what's needed and show you an execution plan before starting. Let's begin!"

# Adaptive Software Development Workflow

---

# 🔵 INCEPTION PHASE

**Purpose**: Planning, requirements gathering, and architectural decisions
**Focus**: Determine WHAT to build and WHY

## Workspace Detection (ALWAYS EXECUTE)

1. Log initial user request in audit.md
2. Check for existing aidlc-state.md (resume if found)
3. Scan workspace for existing code
4. Determine if brownfield or greenfield
5. Check for existing reverse engineering artifacts
6. Log findings in audit.md

## Reverse Engineering (CONDITIONAL - Brownfield Only)

**Execute IF**: Existing codebase detected AND no previous artifacts found
**Skip IF**: Greenfield project OR artifacts exist

**Steps**:
1. Log start in audit.md
2. Analyze packages and components
3. Generate architecture documentation
4. Generate code structure documentation
5. Generate API documentation
6. Generate component inventory
7. Generate technology stack documentation
8. Generate dependencies documentation
9. Generate code quality assessment
10. Wait for approval before proceeding

## Requirements Analysis (ALWAYS EXECUTE - Adaptive Depth)

**Depth varies**: Minimal (simple) → Standard (normal) → Comprehensive (complex)

**Steps**:
1. Log user input in audit.md
2. Load reverse engineering artifacts (if brownfield)
3. Analyze user request (intent analysis)
4. Determine requirements depth needed
5. Assess current requirements
6. Ask clarifying questions (if needed)
7. Generate requirements document
8. Wait for approval before proceeding

## User Stories (CONDITIONAL)

**Execute IF**: Multiple personas, UX impact, acceptance criteria needed
**Skip IF**: Internal refactoring, bug fixes, technical debt, infrastructure changes

**Steps**:
1. Log user input in audit.md
2. Load reverse engineering artifacts (if brownfield)
3. Reference requirements (if exist)
4. **Part 1 - Planning**: Create story plan with questions
5. Wait for answers and analyze for ambiguities
6. Get approval for plan
7. **Part 2 - Generation**: Execute plan to generate stories
8. Wait for approval before proceeding

## Workflow Planning (ALWAYS EXECUTE)

1. Log user input in audit.md
2. Load all prior context (reverse engineering, requirements, stories)
3. Determine which phases to execute
4. Determine depth level for each phase
5. Create multi-package change sequence (if brownfield)
6. Generate workflow visualization
7. Wait for approval before proceeding

## Application Design (CONDITIONAL)

**Execute IF**: New components/services needed, methods/business rules need definition
**Skip IF**: Changes within existing boundaries, no new components

**Steps**:
1. Log user input in audit.md
2. Load reverse engineering artifacts (if brownfield)
3. Execute at appropriate depth
4. Wait for approval before proceeding

## Design - Units Generation (CONDITIONAL)

**Execute IF**: New data models, API changes, complex algorithms, state management
**Skip IF**: Simple logic, UI-only, configuration updates

**Steps**:
1. Log user input in audit.md
2. Load reverse engineering artifacts (if brownfield)
3. **Per-Unit Loop**: For each unit:
   - Functional Design (CONDITIONAL)
   - NFR Requirements Assessment (CONDITIONAL)
   - NFR Design (CONDITIONAL)
   - Infrastructure Design (CONDITIONAL)
   - Code Generation (ALWAYS)
4. Complete unit fully before next unit
5. Wait for approval before proceeding

---

# 🟢 CONSTRUCTION PHASE

**Purpose**: Detailed design, NFR implementation, and code generation
**Focus**: Determine HOW to build it

## Build and Test (ALWAYS EXECUTE)

1. Log user input in audit.md
2. Generate comprehensive build and test instructions:
   - Build instructions for all units
   - Unit test execution instructions
   - Integration test instructions
   - Performance test instructions (if applicable)
   - Additional tests as needed
3. Create instruction files
4. Wait for approval before proceeding

---

# 🟡 OPERATIONS PHASE

**Purpose**: Placeholder for future deployment and monitoring
**Status**: Currently placeholder

---

## Key Principles

- **Adaptive Execution**: Only execute stages that add value
- **Transparent Planning**: Always show execution plan before starting
- **User Control**: User can request stage inclusion/exclusion
- **Progress Tracking**: Update aidlc-state.md with executed and skipped stages
- **Complete Audit Trail**: Log ALL user inputs and AI responses in audit.md
- **Quality Focus**: Complex changes get full treatment, simple changes stay efficient

## Directory Structure
```
aidlc-docs/
├── inception/
│   ├── plans/
│   ├── reverse-engineering/
│   ├── requirements/
│   ├── user-stories/
│   └── application-design/
├── construction/
│   ├── plans/
│   ├── design/
│   ├── code/
│   ├── build-instructions.md
│   ├── unit-test-instructions.md
│   ├── integration-test-instructions.md
│   └── performance-test-instructions.md
├── operations/
├── aidlc-state.md
└── audit.md
```
