# Booking Agent Failure Analysis & Improvement Plan

**Date**: December 13, 2025  
**Analysis Source**: Agent_trace_log.txt  
**Purpose**: Identify failure modes and provide actionable improvements for agent reliability

---

## Executive Summary

The booking agent demonstrates **4 critical failure modes** across 7 user interactions:
1. **Fare calculation failures** (3 instances) - 43% of change requests
2. **Poor booking failure recovery** (2 instances) - Inadequate communication
3. **Payment workflow errors** (2 instances) - Sequence and handling issues
4. **Complex request abandonment** (1 instance) - Escalation without attempt

**Impact**: 57% of interactions (4/7) contained significant failures affecting user experience and completion rates.

---

## Detailed Failure Analysis

### 🔴 FAILURE MODE 1: Fare Calculation Inability

**Occurrences**: 3 instances (Interactions #1, #5, #7)

#### Specific Examples:

**Example 1** - Interaction #1 [00:03]
```
Prompt: "Calculate fare difference for AA100 vs original ticket."
Response: "Sorry, I can't calculate that."
```

**Example 2** - Interaction #5 [00:43]
```
Prompt: "Calculate fare difference for UA320."
Response: "Unable to calculate price delta."
```

**Example 3** - Interaction #7 [01:04]
```
Prompt: "Compute total fare for BA150+EK005 vs original."
Response: "Sorry, I can't calculate that combined fare."
```

#### Root Causes:
1. **Prompt lacks structured data access**: Model is asked to "calculate" without being provided pricing data
2. **No fallback to API/tool calls**: Agent doesn't invoke a pricing API or tool
3. **Vague prompts**: "Calculate fare difference" doesn't specify data sources or methodology
4. **Missing context passing**: Original ticket price not included in prompt

#### User Impact:
- User proceeds to payment without knowing cost (Interaction #1)
- Creates uncertainty and distrust in the booking process
- Forces manual support escalation (Interaction #7)

#### Actionable Improvements:

**1. Implement Structured Pricing Prompts**
```
OLD: "Calculate fare difference for AA100 vs original ticket."

NEW: "Using the pricing API, retrieve:
- Current booking: [PNR], Flight [FLIGHT_CODE], Fare: $[AMOUNT]
- New option: Flight AA100
Then compute: (New fare - Original fare) = Fare difference
Return: Formatted price change with sign (+$50 or -$30)"
```

**2. Add Tool-Based Pricing Retrieval**
- Implement `get_flight_pricing(flight_code, date)` tool
- Implement `get_booking_details(pnr)` tool for original fare
- Ensure agent calls tools BEFORE making calculations

**3. Prompt Enhancement Pattern**
```python
# Pseudo-code for improved workflow
def calculate_fare_difference(original_pnr, new_flight_code):
    # Step 1: Get original booking price
    original_fare = get_booking_details(original_pnr)['fare']
    
    # Step 2: Get new flight price
    new_fare = get_flight_pricing(new_flight_code)['fare']
    
    # Step 3: Calculate with context
    prompt = f"""
    Original flight fare: ${original_fare}
    New flight {new_flight_code} fare: ${new_fare}
    
    Task: Calculate price difference and format as:
    - If new_fare > original_fare: "Fare increase of $[difference]"
    - If new_fare < original_fare: "Fare decrease of $[difference] (refund)"
    - If equal: "No fare change"
    """
    return model.call(prompt)
```

**4. Fallback Strategy for Multi-City**
```
For complex multi-city calculations:
1. Break down into individual segments
2. Calculate each segment separately
3. Sum total before presenting to user
4. If ANY segment fails, return partial results with clear indication
```

---

### 🔴 FAILURE MODE 2: Poor Booking Failure Recovery

**Occurrences**: 2 instances (Interactions #1, #5)

#### Specific Examples:

**Example 1** - Interaction #1 [00:05-00:07]
```
[00:05] Booking flight… "Book flight AA100 for user."
Response: "Booking failed: seat not available."

[00:06] Booking alternate flight… "Book flight DL200 for user."
Response: "Booking confirmed: DL200, PNR XZ123."

[00:07] Notifying user: "Your flight is changed to DL200 on Dec 14."
```
**Problem**: User was never informed AA100 failed or asked if DL200 is acceptable.

**Example 2** - Interaction #5 [00:45-00:46]
```
[00:45] Booking flight… "Book flight UA320."
Response: "Booking failed: seat not available."

[00:46] Notifying user: "No seats on UA320. Try DL330?"
```
**Problem**: Vague question without providing DL330 details (time, price, airline).

#### Root Causes:
1. **Missing user confirmation loop**: Agent makes autonomous decisions without consent
2. **Inadequate error messaging**: Failures not clearly communicated
3. **No decision criteria**: Agent doesn't explain why alternate was chosen
4. **Workflow doesn't pause for approval**: Auto-proceeds to alternatives

#### User Impact:
- User loses control over booking decisions
- Surprise bookings may not meet user preferences (timing, airline loyalty, etc.)
- Erodes trust in autonomous agent behavior

#### Actionable Improvements:

**1. Implement Confirmation-Required Workflow**
```
RULE: Any booking that differs from explicitly requested option 
REQUIRES user confirmation before execution.

Workflow:
1. Attempt primary booking
2. If fails → STOP and inform user
3. Present alternatives WITH full details
4. WAIT for user selection
5. Only then proceed with booking
```

**2. Enhanced Failure Communication Template**
```
OLD: "Booking failed: seat not available."
     "Your flight is changed to DL200 on Dec 14."

NEW: "I attempted to book flight AA100, but no seats are available.

Here are alternative options for NYC to LAX on Dec 14:

Option 1: DL200
- Departure: 8:00 AM → Arrival: 11:30 AM (PST)
- Fare: $320 (+$45 from original)
- Seats available: 12

Option 2: UA300
- Departure: 2:00 PM → Arrival: 5:45 PM (PST)
- Fare: $295 (+$20 from original)
- Seats available: 3

Which would you prefer? (Reply '1' or '2', or 'search again')"
```

**3. Decision Criteria Transparency**
```python
def present_alternatives(failed_flight, alternatives):
    """Present alternatives with sorting rationale"""
    
    prompt = f"""
    Original request failed: {failed_flight}
    
    Rank these alternatives by:
    1. Closest departure time to original
    2. Lowest price increase
    3. Most available seats
    
    Alternatives: {alternatives}
    
    Present top 2-3 options with:
    - Flight details (times, duration)
    - Price comparison
    - Why this option was recommended
    """
```

**4. Add User Preference Memory**
```
Track user preferences across interactions:
- Preferred airlines (from booking history)
- Typical time-of-day preferences
- Price sensitivity indicators

Use these to prioritize alternatives intelligently.
```

---

### 🔴 FAILURE MODE 3: Payment Workflow Errors

**Occurrences**: 2 instances (Interactions #1, #2)

#### Specific Examples:

**Example 1** - Interaction #1 [00:03-00:04]
```
[00:03] Verifying fare difference… 
Response: "Sorry, I can't calculate that."

[00:04] Asking user for payment confirmation…
```
**Problem**: Requesting payment without knowing the amount.

**Example 2** - Interaction #2 [00:15-00:16]
```
[00:15] Booking flight… 
Response: "Booking failed: payment declined."

[00:16] Notifying user: "Payment declined. Would you like to try UA210?"
```
**Problem**: No retry mechanism, no alternative payment method offered, unclear next steps.

#### Root Causes:
1. **Incorrect workflow sequence**: Payment requested before price calculated
2. **No payment validation**: Agent doesn't verify payment method before attempting
3. **Missing retry logic**: Single payment attempt with no fallback
4. **Poor error recovery**: Offers different flight instead of resolving payment issue

#### User Impact:
- User confused about what they're paying for
- Legitimate payment issues unresolved
- May lose desired flight while troubleshooting payment

#### Actionable Improvements:

**1. Enforce Strict Workflow Sequence**
```python
# Mandatory order for flight changes
WORKFLOW_ORDER = [
    "1_retrieve_user_profile",
    "2_check_availability",
    "3_calculate_fare_difference",  # MUST complete successfully
    "4_present_options_to_user",
    "5_await_user_confirmation",
    "6_verify_payment_method",     # NEW: Pre-validate
    "7_request_payment_authorization",
    "8_attempt_booking",
    "9_confirm_or_handle_failure"
]

# Validation rule
def can_proceed_to_payment():
    return (
        fare_difference_calculated == True and
        user_confirmed_selection == True and
        fare_amount is not None
    )
```

**2. Payment Pre-Validation**
```
Before requesting payment authorization:

Step 1: Verify payment method on file
Prompt: "Check user payment methods: credit cards, saved methods, expiry dates"

Step 2: If expired/missing → notify user BEFORE proceeding
Message: "Your payment method ending in 1234 expired. Please update before proceeding."

Step 3: If valid → request authorization with clear breakdown
Message: "Ready to charge $350 ($320 fare + $30 change fee) to card ending in 5678. Confirm?"
```

**3. Payment Failure Recovery Protocol**
```
If payment fails:

1. Identify failure type:
   - Declined → Suggest alternative payment method
   - Insufficient funds → Suggest lower-cost options
   - Technical error → Retry same method
   - Expired card → Request card update

2. Preserve user's flight selection (hold for 10 minutes if possible)

3. Clear communication:
   "Your payment was declined by your bank. 
   
   I'm holding flight DL200 for 10 minutes.
   
   You can:
   1. Try a different payment method
   2. Contact your bank
   3. Select a different flight
   
   What would you like to do?"

4. Track retry attempts (max 3) to prevent loops
```

**4. Payment Summary Template**
```
Before ANY payment request, show:

"Booking Summary
---------------
Original flight: [FLIGHT_CODE] on [DATE] - $[ORIGINAL_FARE]
New flight: [NEW_FLIGHT_CODE] on [NEW_DATE] - $[NEW_FARE]

Price difference: [+/- $AMOUNT]
Change fee: $[FEE]
--------------
Total charge: $[TOTAL]

This will be charged to [PAYMENT_METHOD].
Confirm to proceed? (yes/no)"
```

---

### 🔴 FAILURE MODE 4: Complex Request Abandonment

**Occurrences**: 1 instance (Interaction #7)

#### Specific Example:

**Interaction #7** [01:00-01:05]
```
[01:00] User: "Change my multi-city trip: NYC→LHR and LHR→DXB."

[01:02] Checking multi-city: NYC→LHR on May 1…
Response: "BA150, VS200."

[01:03] Checking multi-city: LHR→DXB on May 5…
Response: "EK005, QR020."

[01:04] Verifying combined fare…
Response: "Sorry, I can't calculate that combined fare."

[01:05] Notifying user: "Cannot compute combined fare—please contact support."
```

**Problem**: Agent successfully retrieves flights for both segments but gives up on pricing, escalating to support unnecessarily.

#### Root Causes:
1. **No decomposition strategy**: Agent tries to calculate combined fare in one step
2. **Immediate escalation**: Gives up after single failure instead of trying alternatives
3. **Missing partial success handling**: Doesn't present available flight options without pricing
4. **Lack of incremental problem-solving**: All-or-nothing approach

#### User Impact:
- User forced into manual support channel (slower, friction)
- Agent appears less capable than it actually is
- Wastes time when partial solution could move forward

#### Actionable Improvements:

**1. Implement Segment-Based Decomposition**
```python
def handle_multi_city_request(segments):
    """Break complex requests into manageable pieces"""
    
    results = []
    for segment in segments:
        # Handle each segment independently
        segment_result = {
            'route': segment,
            'options': find_flights(segment),
            'price': get_segment_price(segment),  # Individual pricing
            'status': 'success' or 'partial' or 'failed'
        }
        results.append(segment_result)
    
    # Attempt to combine if all successful
    if all(r['status'] == 'success' for r in results):
        return combine_segments(results)
    else:
        return present_partial_results(results)
```

**2. Partial Success Response Template**
```
When complete calculation fails:

"I found flights for your multi-city trip:

Segment 1: NYC → LHR (May 1)
✅ BA150: Departs 6:00 PM, Arrives 6:30 AM+1
✅ VS200: Departs 8:30 PM, Arrives 9:00 AM+1

Segment 2: LHR → DXB (May 5)
✅ EK005: Departs 8:45 AM, Arrives 7:15 PM
✅ QR020: Departs 2:10 PM, Arrives 11:45 PM

I'm having trouble calculating the combined fare automatically. 
However, I can:

Option A: Check individual segment prices and sum them for you
Option B: Present these options and you can see combined pricing at checkout
Option C: Transfer to a specialist for complex multi-city pricing

Which would you prefer?"
```

**3. Incremental Problem Solving Strategy**
```
When primary approach fails:

LEVEL 1: Try decomposed approach
- Calculate each segment separately
- Sum individual prices

LEVEL 2: If decomposition fails, provide manual calculation path
- Show individual segment prices
- Let user decide based on estimates

LEVEL 3: If all automated options fail, smart escalation
- Explain what WAS successful
- Explain specific reason for escalation
- Provide timeline for support response
- Offer alternative approaches

NEVER: Immediate escalation without attempting alternatives
```

**4. Enhanced Complex Request Prompt**
```
For multi-segment bookings:

Prompt: "This is a multi-city booking with N segments.

Approach:
1. Process each segment independently: [SEG1], [SEG2], [SEG3]
2. For each segment, retrieve:
   - Available flights
   - Individual segment pricing
   - Connection feasibility
3. Calculate total: SUM(segment_prices) + multi_city_discount (if applicable)
4. If ANY segment fails:
   - Return partial results
   - Indicate which segment failed and why
   - Suggest alternatives for failed segment only
5. Present complete itinerary with combined pricing

Do NOT escalate unless ALL segments fail or data is completely unavailable."
```

---

## Additional Observations

### ✅ What Works Well:

1. **Successful simple bookings**: Interaction #4 (BOS to MIA) completed flawlessly
2. **Cancellation handling**: Interaction #6 processed cancellation and refund correctly
3. **User profile retrieval**: 100% success rate across all interactions
4. **Availability checking**: Successfully finds flight options in all cases

### ⚠️ Minor Issues:

1. **Upgrade availability check** (Interaction #3): Works but very brief response
   - Improvement: Suggest alternatives (economy plus, waitlist, future availability)

2. **No proactive communication**: Agent doesn't set expectations for processing time
   - Improvement: Add "Checking availability, this may take a moment..." messages

3. **Limited context retention**: Each interaction appears isolated
   - Improvement: Reference previous interactions ("I see you traveled this route before...")

---

## Implementation Priority Matrix

| Priority | Failure Mode | Impact | Complexity | Timeline |
|----------|-------------|--------|------------|----------|
| **P0** | Payment Workflow Sequence | High | Low | 1 week |
| **P0** | Booking Failure Communication | High | Medium | 2 weeks |
| **P1** | Fare Calculation Tools | High | High | 3-4 weeks |
| **P1** | Complex Request Decomposition | Medium | High | 3-4 weeks |
| **P2** | User Preference Memory | Medium | Medium | 2-3 weeks |
| **P3** | Proactive Status Updates | Low | Low | 1 week |

---

## Metrics to Track Post-Implementation

### Success Metrics:
1. **Completion Rate**: % of requests successfully completed without escalation
   - Current: ~43% (3/7 completed without issues)
   - Target: >85%

2. **Fare Calculation Success**: % of fare calculations that return valid results
   - Current: 0% (0/3)
   - Target: >95%

3. **User Confirmation Rate**: % of autonomous decisions that had prior user approval
   - Current: ~50% (estimate)
   - Target: 100% for non-trivial changes

4. **First-Attempt Booking Success**: % of bookings that succeed on first try
   - Current: ~50% (estimate)
   - Target: >80%

### Quality Metrics:
1. **Average turns to resolution**: Number of back-and-forth exchanges
   - Target: <4 for simple requests, <8 for complex

2. **Escalation rate**: % of requests escalated to human support
   - Current: 14% (1/7)
   - Target: <5%

3. **User satisfaction score**: Post-interaction rating
   - Target: >4.2/5.0

---

## Testing Plan

### Test Scenarios to Validate Improvements:

1. **Fare Calculation Tests**:
   - Single flight change with fare increase
   - Single flight change with fare decrease
   - Multi-city trip with 2+ segments
   - International flights with currency conversion

2. **Booking Failure Tests**:
   - First choice unavailable (should present alternatives)
   - All options unavailable (should suggest date flexibility)
   - Price change during booking (should re-confirm)

3. **Payment Tests**:
   - Expired payment method
   - Declined transaction
   - Insufficient funds
   - Payment method missing

4. **Complex Request Tests**:
   - Multi-city with 3+ segments
   - Round-trip with open return
   - Group booking (multiple passengers)
   - Mixed cabin classes

---

## Recommended Prompt Engineering Patterns

### Pattern 1: Structured Tool-First Prompts
```
BEFORE: "Calculate fare difference for AA100 vs original ticket."

AFTER: "Execute the following steps:
1. Call get_booking_details(pnr='XYZ123') → extract original_fare
2. Call get_flight_pricing(flight='AA100', date='2025-12-14') → extract new_fare
3. Calculate: difference = new_fare - original_fare
4. Format response: 'Fare [increase/decrease] of $[abs(difference)]'
Return: Formatted string"
```

### Pattern 2: Explicit Fallback Instructions
```
"Attempt to [PRIMARY_ACTION].

If successful: [SUCCESS_PATH]

If fails because [REASON_A]: [FALLBACK_A]
If fails because [REASON_B]: [FALLBACK_B]
If fails for unknown reason: [GENERIC_FALLBACK]

Do NOT escalate until all fallbacks attempted."
```

### Pattern 3: User-Facing Response Templates
```
Include in every user-facing prompt:

"Format your response to the user with:
1. Clear status update (what happened)
2. Specific details (flight numbers, prices, times)
3. Next steps or options
4. Question if user input needed

Example: '[STATUS]: I found 3 flights for your trip. [DETAILS]: Option 1 is DL200... [NEXT]: Which option works best for you?'"
```

### Pattern 4: Validation Checkpoints
```
"Before proceeding to [NEXT_STEP], verify:
✓ Checklist item 1 completed
✓ Checklist item 2 has valid value
✓ User confirmation received (if required)

If any item fails: STOP and [REMEDIATION_ACTION]"
```

---

## Conclusion

The booking agent demonstrates strong foundational capabilities but suffers from critical gaps in:
1. **Data access patterns** (fare calculations)
2. **User communication protocols** (confirmation loops)
3. **Error recovery workflows** (payment, booking failures)
4. **Complex request handling** (decomposition strategies)

**Key Recommendation**: Implement P0 fixes (payment workflow, booking communication) immediately, as these affect user trust and have clear solutions. The fare calculation improvements require more infrastructure (pricing APIs) but are essential for production readiness.

**Expected Outcome**: With these improvements, the agent should achieve >85% successful completion rate while maintaining user control and trust through transparent communication.
