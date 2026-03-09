import * as core from '@actions/core';
import * as github from '@actions/github';
import { TestResult } from './executor';

export async function reportResults(results: TestResult[], token: string) {
  try {
    const context = github.context;
    
    // Check if we are running in GitHub Actions context
    if (!process.env.GITHUB_ACTIONS) {
      core.info("Running locally. Skipping GitHub PR comment posting.");
      // Just print the results
      const totalPassed = results.filter(r => r.passed).length;
      const totalFailed = results.length - totalPassed;
      core.info(`Summary: ${totalPassed} Passed | ${totalFailed} Failed`);
      if (totalFailed > 0) core.setFailed(`UI Validation Failed: ${totalFailed} test(s) did not pass.`);
      return;
    }

    if (!context.payload.pull_request) {
      core.warning("Not running in a pull request context. Skipping comment.");
      return;
    }

    const prNumber = context.payload.pull_request.number;
    const octokit = github.getOctokit(token);
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    let body = `## UI QA Agent Validation Results\n\n`;
    
    for (const res of results) {
      if (res.passed) totalPassed++;
      else totalFailed++;
      
      const icon = res.passed ? '✅' : '❌';
      body += `### ${icon} ${res.testCase.id}: ${res.testCase.title}\n`;
      body += `**Expected Result:** ${res.testCase.expectedResult}\n`;
      
      if (!res.passed && res.reason) {
         body += `**Error Details:**\n\`\`\`\n${res.reason}\n\`\`\`\n`;
      }
      
      // Note: GitHub doesn't easily allow raw image uploads via Comment API without hosting them elsewhere.
      // Often, teams upload to S3/Imgur/GH Artifacts and link them.
      // For this test, we mention the screenshots are in the workflow artifacts.
      body += `\n*A screenshot of this test state has been saved as an artifact: \`${res.testCase.id}.png\`.*\n\n`;
    }
    
    body += `---\n**Summary**: ${totalPassed} Passed | ${totalFailed} Failed\n`;
    
    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body
    });
    
    // Block PR if there are failures
    if (totalFailed > 0) {
      core.setFailed(`UI Validation Failed: ${totalFailed} test(s) did not pass.`);
    } else {
      core.info("All UI validations passed successfully.");
    }

  } catch (error) {
    core.setFailed(`Failed to report results: ${error instanceof Error ? error.message : String(error)}`);
  }
}
