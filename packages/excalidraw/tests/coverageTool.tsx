const fs = require('fs');

const coverageInfo: { [functionName: string]: { [branchId: string]: boolean } } = {};

const totalBranches: { [functionName: string]: number } = {};

export const initializeCoverage = (functionName: string, totalBranchesCount: number) => {
  coverageInfo[functionName] = {};
  totalBranches[functionName] = totalBranchesCount;
};

export const logCoverage = (functionName: string, branchId: string) => {
  if (!coverageInfo[functionName]) {
    throw new Error(`Function ${functionName} not initialized for coverage tracking.`);
  }
  coverageInfo[functionName][branchId] = true;
};

export const outputCoverageInfo = () => {
  const filePath = "coverageInfo.txt"

  let output = 'Coverage Information:\n';
  for (const functionName in coverageInfo) {
    output += `Function: ${functionName}\n`;
    let coveredBranches = 0;
    const branches = coverageInfo[functionName];
    for (const branch in branches) {
      output += `  Branch ${branch}: ${branches[branch] ? 'Covered' : 'Not Covered'}\n`;
      if (branches[branch]) {
        coveredBranches++;
      }
    }
    const coveragePercentage = (coveredBranches / totalBranches[functionName]) * 100;
    output += `  Branch Coverage: ${coveragePercentage.toFixed(2)}%\n`;
  }
  
  fs.writeFileSync(filePath, output, 'utf8');
};