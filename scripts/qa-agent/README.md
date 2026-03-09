# UI QA Agent

This folder contains the UI QA Agent scripts that automatically evaluate Excalidraw functionality by parsing Pull Requests, simulating user interactions using Playwright, analyzing results using OpenAI's models, and posting a summary back to the GitHub PR.

## Overview of Components

1. **`parser.ts`**: Extracts structured test cases from the `QA_TESTING` section of a Pull Request description.
2. **`executor.ts`**: Operates a headless browser (Playwright) against the Excalidraw UI. It utilizes OpenAI to intelligently execute the text-based steps on the canvas and performs visual validation of the outcome.
3. **`reporter.ts`**: Compiles the execution results (Pass/Fail, screenshots) and posts a comment back to the GitHub PR using the `octokit` GitHub API.
4. **`index.ts`**: The main entrypoint that stitches these components together.

## Requirements and API Keys

To run the QA Agent, it requires an **OpenAI API Key** to dynamically convert natural language steps into UI interactions and to perform visual validations.

### How to obtain an OpenAI API Key
1. **Create an account**: Go to [platform.openai.com](https://platform.openai.com/signup) and sign up or log in.
2. **Set up billing**: Navigate to the **Billing** section and configure a payment method. API access requires adding credits to your account.
3. **Generate an API Key**:
   - Go to the **API keys** page (`https://platform.openai.com/api-keys`).
   - Click **"Create new secret key"**.
   - Give the key a descriptive name (e.g., `Excalidraw QA Agent`).
   - Copy the key immediately, as you won't be able to view it again.
4. **Permissions**: When creating the key, you can choose **Restricted** permissions to scope the key's access. The QA Agent requires only one permission:
   - **Model capabilities > Chat completions**: Write

### Setting up the Key for GitHub Actions
The UI QA Agent runs automatically in GitHub Actions via `.github/workflows/qa-agent.yml`. 
To provide the API key:
1. Go to your repository on GitHub.
2. Navigate to **Settings** > **Secrets and variables** > **Actions**.
3. Click **"New repository secret"**.
4. Name the secret **`OPENAI_API_KEY`** and paste the key. 
5. The GitHub Action will automatically inject this secret into the runtime environment.

## Running Locally

For instructions on how to run the QA Agent script locally (e.g. for debugging or testing new test cases), please refer to the **QA Agent Write-up & Tradeoffs** section in the [main repository README](../../README.md).

## Example PR Descriptions

To trigger the UI QA Agent, include a `QA_TESTING` block in your Pull Request description that matches the format outlined below. The parser expects the sections `## What Changed`, `## Expected Functionality`, and `## Test Cases`. Test cases should follow the `### TC-ID:` convention, along with `**Preconditions:**`, `**Steps:**` as a numbered list, and `**Expected Result:**`.

Here are a few example PR bodies that the QA agent will successfully parse and execute:

### Example 1: Testing the Rectangle Selection

```markdown
Some standard PR context goes here before the testing block...

---

QA_TESTING

## What Changed
Added a new color variant for rectangles.

## Expected Functionality
Users should be able to select the rectangle tool, draw a rectangle on the canvas, and see the rectangle appear with default styling.

## Test Cases
### TC-1: Draw a basic rectangle
**Preconditions:** Excalidraw is loaded and the canvas is empty.
**Steps:**
1. Click on the Rectangle tool in the top toolbar.
2. Click and drag on the center of the canvas to draw a shape.
3. Release the mouse.
**Expected Result:** A visible rectangle should be drawn on the canvas, selected, with bounding box controls visible.
```

### Example 2: Testing Text Input

```markdown
QA_TESTING

## What Changed
Updated the rich text editor to support multiline text wrapping.

## Expected Functionality
When a user adds text to the canvas and types a sentence, the text should wrap correctly if constrained by a bounding box.

## Test Cases
### TC-2: Add text to canvas
**Preconditions:** Excalidraw is loaded on an empty canvas.
**Steps:**
1. Select the Text tool (or press 'T').
2. Click anywhere on the canvas.
3. Type "Hello world this is a test of the text tool."
4. Click outside the text area to deselect it.
**Expected Result:** "Hello world this is a test of the text tool." should be visible on the canvas where the user clicked.
```
