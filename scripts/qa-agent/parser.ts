import * as core from '@actions/core';

export interface TestCase {
  id: string;
  title: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
}

export interface QAPlan {
  whatChanged: string;
  expectedFunctionality: string;
  testCases: TestCase[];
}

export function parseQATestingSection(prBody: string): QAPlan | null {
  try {
    const qaSectionRegex = /QA_TESTING([\s\S]*?)($)/i;
    const match = prBody.match(qaSectionRegex);

    if (!match) {
      core.info("No QA_TESTING section found in PR description.");
      return null;
    }

    const qaContent = match[1];

    // Extract 'What Changed'
    const whatChangedMatch = qaContent.match(/## What Changed\s+([\s\S]*?)(?=## Expected Functionality|## Test Cases|$)/i);
    const whatChanged = whatChangedMatch ? whatChangedMatch[1].trim() : '';

    // Extract 'Expected Functionality' 
    const expectedFunctionalityMatch = qaContent.match(/## Expected Functionality\s+([\s\S]*?)(?=## Test Cases|$)/i);
    const expectedFunctionality = expectedFunctionalityMatch ? expectedFunctionalityMatch[1].trim() : '';

    // Extract Test Cases
    const testCasesMatch = qaContent.match(/## Test Cases\s+([\s\S]*?)$/i);
    const testCasesText = testCasesMatch ? testCasesMatch[1] : '';

    const testCases: TestCase[] = [];
    const testCasePattern = /### (TC-\d+):\s*(.*?)\s*\*\*Preconditions:\*\*\s*(.*?)\s*\*\*Steps:\*\*\s*(.*?)\s*\*\*Expected Result:\*\*\s*(.*?)(?=### TC-\d+:|$)/gis;

    let tcMatch;
    while ((tcMatch = testCasePattern.exec(testCasesText)) !== null) {
      const id = tcMatch[1].trim();
      const title = tcMatch[2].trim();
      const preconditions = tcMatch[3].trim();
      const stepsRaw = tcMatch[4].trim();
      const expectedResult = tcMatch[5].trim();

      // Parse steps into an array
      // Example: "1.Step one. 2.Step two. 3.Step three."
      const stepsRegex = /\d+\.\s*(.*?)(?=\d+\.|$)/g;
      const steps: string[] = [];
      let stepMatch;
      
      // If it doesn't match the list format nicely, just split by "." or keep as one step
      let matchedAnyStep = false;
      while ((stepMatch = stepsRegex.exec(stepsRaw)) !== null) {
        if (stepMatch[1].trim()) {
           steps.push(stepMatch[1].trim());
           matchedAnyStep = true;
        }
      }
      
      if (!matchedAnyStep) {
         // Fallback if formatting was slightly off
         steps.push(stepsRaw);
      }

      testCases.push({
        id,
        title,
        preconditions,
        steps,
        expectedResult
      });
    }

    return {
      whatChanged,
      expectedFunctionality,
      testCases
    };
  } catch (error) {
    core.error(`Failed to parse QA_TESTING section: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
