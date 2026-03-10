import fs from 'fs';
import path from 'path';

const featuresDir = path.join(__dirname, '../../features');
const outputFile = path.join(__dirname, '../../../docs/BDD_SCENARIOS.md');

const featureFiles = fs.readdirSync(featuresDir).filter(f => f.endsWith('.feature'));

let markdown = '# BDD Scenarios\n\nGenerated from Gherkin feature files.\n\n';

for (const file of featureFiles.sort()) {
  const content = fs.readFileSync(path.join(featuresDir, file), 'utf-8');
  const lines = content.split('\n');
  let featureName = '';
  const scenarios: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Feature:')) {
      featureName = trimmed.replace('Feature:', '').trim();
    } else if (trimmed.startsWith('Scenario:')) {
      scenarios.push(trimmed.replace('Scenario:', '').trim());
    }
  }

  if (featureName) {
    markdown += `## ${featureName}\n\n`;
    markdown += `**File:** \`features/${file}\`\n\n`;
    if (scenarios.length > 0) {
      markdown += '| # | Scenario |\n|---|----------|\n';
      scenarios.forEach((s, i) => {
        markdown += `| ${i + 1} | ${s} |\n`;
      });
    }
    markdown += '\n';
  }
}

fs.writeFileSync(outputFile, markdown);
console.log(`Generated ${outputFile}`);
