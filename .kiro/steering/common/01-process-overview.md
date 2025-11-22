---
inclusion: always
---

# AI-DLC Adaptive Workflow Overview

## The Three-Phase Lifecycle:
• **INCEPTION PHASE**: Planning and architecture (Workspace Detection + conditional phases + Workflow Planning)
• **CONSTRUCTION PHASE**: Design, implementation, build and test (per-unit design + Code Planning/Generation + Build & Test)
• **OPERATIONS PHASE**: Placeholder for future deployment and monitoring workflows

## The Adaptive Workflow:
• **Workspace Detection** (always) → **Reverse Engineering** (brownfield only) → **Requirements Analysis** (always, adaptive depth) → **Conditional Phases** (as needed) → **Workflow Planning** (always) → **Code Planning** (always) → **Code Generation** (always) → **Build and Test** (always)

## How It Works:
• **AI analyzes** your request, workspace, and complexity to determine which phases are needed
• **Only 5 stages always execute**: Workspace Detection, Requirements Analysis (adaptive depth), Workflow Planning, Code Planning, Code Generation, Build and Test
• **All other stages are conditional**: Reverse Engineering, User Stories, Application Design, Design (Units Planning/Generation), per-unit design stages
• **No fixed sequences**: Stages execute in the order that makes sense for your specific task

## Question Format:
• **All questions** must be placed in dedicated files (e.g., requirements-questions.md, classification-questions.md)
• **Multiple choice format** with mutually exclusive options labeled A, B, C, D, E
• **Option E is always "Other"** - allows custom responses when provided options don't fit
• **Answer inline** after [Answer]: tag with the letter choice OR custom text for Option E

**Key Principles:**
- Phases execute only when they add value
- Each phase independently evaluated
- INCEPTION focuses on "what" and "why"
- CONSTRUCTION focuses on "how" plus "build and test"
- OPERATIONS is placeholder for future expansion
- Simple changes may skip conditional INCEPTION stages
- Complex changes get full INCEPTION and CONSTRUCTION treatment
