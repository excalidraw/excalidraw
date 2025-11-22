# Requirements Analysis (Adaptive)

**Assume the role** of a product owner

**Adaptive Phase**: Always executes but depth varies from minimal to comprehensive

## Prerequisites
- Workspace Detection must be complete
- Reverse Engineering must be complete (if brownfield)

## Depth Levels

### Minimal Depth
**When**: Simple clarification needed, intent mostly clear
**Actions**:
- Create single question file with 1-3 clarifying questions
- Generate lightweight requirements.md
- Skip verification questions

### Standard Depth
**When**: Normal complexity, standard requirements gathering
**Actions**:
- Full requirements assessment
- Verification questions if needed
- Functional + non-functional requirements

### Comprehensive Depth
**When**: Complex project, multiple stakeholders, high risk
**Actions**:
- Detailed requirements with all sections
- Multiple rounds of verification questions
- Full traceability matrix

## Execution Steps

### Step 1: Load Reverse Engineering Context (if available)

**IF brownfield project**:
- Load `aidlc-docs/inception/reverse-engineering/architecture.md`
- Load `aidlc-docs/inception/reverse-engineering/component-inventory.md`
- Load `aidlc-docs/inception/reverse-engineering/technology-stack.md`
- Use these to understand existing system when analyzing request

### Step 2: Analyze User Request (Intent Analysis)

#### 2.1 Request Clarity
- **Clear**: Specific, well-defined, actionable
- **Vague**: General, ambiguous, needs clarification
- **Incomplete**: Missing key information

#### 2.2 Request Type
- **New Feature**: Adding new functionality
- **Bug Fix**: Fixing existing issue
- **Refactoring**: Improving code structure
- **Upgrade**: Updating dependencies or frameworks
- **Migration**: Moving to different technology
- **Enhancement**: Improving existing feature
- **New Project**: Starting from scratch

#### 2.3 Initial Scope Estimate
- **Single File**: Changes to one file
- **Single Component**: Changes to one component/package
- **Multiple Components**: Changes across multiple components
- **System-wide**: Changes affecting entire system
- **Cross-system**: Changes affecting multiple systems

#### 2.4 Initial Complexity Estimate
- **Trivial**: Simple, straightforward change
- **Simple**: Clear implementation path
- **Moderate**: Some complexity, multiple considerations
- **Complex**: Significant complexity, many considerations

### Step 3: Determine Requirements Depth

**Based on request analysis, determine depth:**

**Minimal Depth** - Use when:
- Request is clear and simple
- No detailed requirements needed
- Just document the basic understanding

**Standard Depth** - Use when:
- Request needs clarification
- Functional and non-functional requirements needed
- Normal complexity

**Comprehensive Depth** - Use when:
- Complex project with multiple stakeholders
- High risk or critical system
- Detailed requirements with traceability needed

### Step 4: Assess Current Requirements

Analyze whatever the user has provided:
   - Intent statements or descriptions
   - Existing requirements documents (search workspace if mentioned)
   - Pasted content or file references
   - Convert any non-markdown documents to markdown format
   - Store user's **complete raw statement** in `aidlc-docs/inception/requirements/user-intent.md` (never summarize - capture exactly as provided) 

### Step 5: Intuitive Completeness Check

Use Amazon Q intelligence to evaluate if requirements are sufficient:
   - **If sufficient**: "Requirements look comprehensive, ready to proceed to stories"
   - **If insufficient**: Identify specific gaps and generate targeted questions

### Step 6: Ask Clarifying Questions (only if needed)
   - Create `aidlc-docs/inception/requirements/requirement-verification-questions.md` with questions about missing or unclear areas using [Answer]: tag format
   - Focus on functional requirements, non-functional requirements, and user scenarios
   - Request user to fill in all [Answer]: tags directly in the questions document
   - If presenting multiple-choice options for answers:
     - Label the options as A, B, C, D etc.
     - Ensure options are mutually exclusive and don't overlap
     - ALWAYS include option for custom response: "E) Other (please describe after [Answer]: tag below)"
   - Wait for user answers in the document
   - **Mandatory** keep asking questions either until you are happy with the requirements or until the user asks you to proceed to next phase explicitly.

### Step 7: Generate Requirements Document
   - Create `aidlc-docs/inception/requirements/requirements.md`
   - Include intent analysis summary at the top:
     - User request
     - Request type
     - Scope estimate
     - Complexity estimate
   - Include both functional and non-functional requirements
   - Incorporate user's answers to clarifying questions
   - Provide brief summary of key requirements

### Step 8: Update State Tracking

Update `aidlc-docs/aidlc-state.md`:

```markdown
## Stage Progress
### 🔵 INCEPTION PHASE
- [x] Workspace Detection
- [x] Reverse Engineering (if applicable)
- [x] Requirements Analysis
```

### Step 9: Log and Proceed
   - Log approval prompt with timestamp in `aidlc-docs/audit.md`
   - Wait for explicit user approval before proceeding
   - Record approval response with timestamp
   - Update Requirements Analysis stage complete in aidlc-state.md