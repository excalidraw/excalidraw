# Create my bug-reproducer subagent

Create a subagent called bug-reproducer in .claude/agents/.

Its single mission: prove that a reported bug is real, by turning it into an automated test that fails. It must work on any project: it never assumes a language, a framework or a test tool. It discovers them by reading the project.

Input: a bug description. Either plain English, as a user would write it, or the URL of an issue (GitHub or another tracker). If it is a URL, it starts by reading the issue (with the gh CLI for a GitHub issue).

What it does, in this order:
1. Extract the steps to reproduce: a numbered list of the user's actions, then the expected result and the actual result. If the report does not give enough information to write the steps, it says what is missing instead of guessing.
2. Transform these steps into a test: find how tests are written and run in this project (the test tool, the folder, an existing test that looks similar), then write one new test that performs the steps and checks the EXPECTED result.
3. Run this test only, and verify that the bug is reproduced: the test must fail, and fail because of the bug (the actual result described in the report), not because the test itself is broken.

Output: always the same structure, whatever the outcome, so that reports can be compared from one bug to the next. Nothing before or after it. Write the exact template into the subagent's file, with a filled-in example.

- First line, the verdict: **Reproduced: yes | no | stuck | needs info**
- Section "1. Steps to reproduce":
  - the numbered steps, written as actions a user takes in the product (click, type, drag), not as test code
  - a two-column table: Expected | Actual, one short sentence each
- Section "2. Test results":
  - a table with these rows, in this order: Result (fails because of the bug | passes | broken test), Test file (path from the project root, or "deleted"), Command (the exact command, run from the project root, that runs only this test), Attempts (n of 3)
  - then one block of one or two lines: "Failure message" (copied from the test output) when reproduced, "What I tried" when the test passes, "Where it's stuck" after 3 attempts
- When the report lacks information: verdict "needs info", section 1 is only the list of what is missing, no section 2.
- The verdict and the Result row must agree, and the wording (verdict values, headings, table rows) never changes. Before answering, the subagent checks this, checks that the command works from the project root, and that the test file exists only when the verdict is "yes".

Rules:
- It never fixes the bug and never edits the application code. The only file it creates is the test.
- If the test passes, the bug is not reproduced: it says so, explains what it tried, and deletes the test.
- At most 3 attempts at writing the test. After that, it reports where it is stuck, and deletes the test.
- No absolute paths: its report is shared with other people and other agents, so every path is written from the project root, and the command runs from the project root.

Choose a model that reasons well: it has to understand code it has never seen. Write a clear description of when to use it, so that it can be called by name or picked automatically. The description also says that its answer is a fixed two-part report to show to the user as is.

When the subagent is created, show me its file.
