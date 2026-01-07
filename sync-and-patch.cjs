#!/usr/bin/env node

/**
 * sync-and-patch.js
 * Automates pulling from upstream and reapplying custom patches
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(message, color = '') {
  console.log(color + message + colors.reset);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'inherit', ...options });
  } catch (error) {
    throw new Error(`Command failed: ${command}`);
  }
}

function execQuiet(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (error) {
    return '';
  }
}

async function main() {
  log('🔄 Starting sync and patch process...', colors.green);

  // Get version from package.json
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = packageJson.version;
  const targetBranch = `p${version}`;

  log(`📦 Package version: ${version}`);
  log(`🎯 Target branch: ${targetBranch}`);

  // Get current branch
  const currentBranch = execQuiet('git branch --show-current');
  log(`📍 Current branch: ${currentBranch}`);

  // Check if upstream remote exists
  const remotes = execQuiet('git remote');
  if (!remotes.split('\n').includes('upstream')) {
    log('❌ Error: \'upstream\' remote not configured', colors.red);
    log('Please add upstream with: git remote add upstream https://github.com/LuanRT/YouTube.js.git');
    process.exit(1);
  }

  // Stash any uncommitted changes
  log('💾 Stashing uncommitted changes...');
  const stashMessage = `Auto-stash before sync ${new Date().toISOString()}`;
  try {
    execQuiet(`git stash push -u -m "${stashMessage}"`);
  } catch (error) {
    // Stash might fail if there's nothing to stash, which is fine
  }

  // Fetch latest from upstream
  log('⬇️  Fetching from upstream...');
  exec('git fetch upstream');

  // Check if target branch exists, create or switch to it
  const branches = execQuiet('git branch --list');
  const branchExists = branches.split('\n').some(b => b.trim() === targetBranch || b.trim() === `* ${targetBranch}`);

  if (branchExists) {
    log(`🔀 Branch ${targetBranch} already exists, switching to it...`);
    exec(`git checkout ${targetBranch}`);
  } else {
    log(`🌿 Creating new branch ${targetBranch} from upstream/main...`);
    exec(`git checkout -b ${targetBranch} upstream/main`);
  }

  // If we were on a different branch and it's not main, merge changes
  if (currentBranch !== targetBranch && currentBranch !== 'main') {
    log(`⚠️  You were on branch: ${currentBranch}`, colors.yellow);
    log(`Merging changes from ${currentBranch} into ${targetBranch}...`);
    try {
      exec(`git merge ${currentBranch} --no-edit`);
      log(`✅ Merge from ${currentBranch} successful`, colors.green);
    } catch (error) {
      log(`⚠️  Could not merge from ${currentBranch}, continuing...`, colors.yellow);
    }
  }

  // Merge upstream changes
  log(`🔀 Merging upstream/main into ${targetBranch}...`);
  try {
    exec('git merge upstream/main --no-edit');
    log('✅ Merge successful', colors.green);
  } catch (error) {
    log('❌ Merge conflict detected', colors.red);
    log('Please resolve conflicts manually, then run: git merge --continue');
    process.exit(1);
  }

  // Apply patches
  log('🔧 Applying custom patches...');

  const innertubeFile = 'src/Innertube.ts';

  if (!fs.existsSync(innertubeFile)) {
    log(`❌ Error: ${innertubeFile} not found`, colors.red);
    process.exit(1);
  }

  let content = fs.readFileSync(innertubeFile, 'utf8');

  // Check if patches are already applied
  if (content.includes('export const Patch')) {
    log(`⚠️  Patches already applied to ${innertubeFile}`, colors.yellow);
  } else {
    log(`📝 Applying patches to ${innertubeFile}...`);

    // Check if YTNode import exists
    if (!content.includes("import { YTNode } from './parser/helpers.js';")) {
      // Find the line with IBrowseResponse import and add YTNode import after it
      const importLine = "import type { IBrowseResponse, IParsedResponse } from './parser/index.js';";
      if (content.includes(importLine)) {
        content = content.replace(
          importLine,
          importLine + "\nimport { YTNode } from './parser/helpers.js';"
        );
        log('  ✓ Added YTNode import');
      }
    }

    // Add custom exports at the end of the file
    const customExports = `
export const Patch = {
  HomeFeed,
  History,
  YTNode
}

export type P_YTNode = YTNode;`;

    content = content + customExports;
    fs.writeFileSync(innertubeFile, content);
    log('  ✓ Added custom exports');
    log('✅ Patches applied successfully', colors.green);
  }

  // Commit patches if there are changes
  const status = execQuiet('git status --porcelain');
  if (status) {
    log('💾 Committing patches...');
    exec(`git add ${innertubeFile}`);
    exec('git commit -m "export on latest"');
    log('✅ Patches committed', colors.green);
  } else {
    log('✨ No changes to commit');
  }

  // Pop stashed changes if any exist
  const stashList = execQuiet('git stash list');
  if (stashList) {
    log('📤 Restoring stashed changes...');
    try {
      exec('git stash pop');
      log('✅ Stashed changes restored', colors.green);
    } catch (error) {
      log('⚠️  Conflicts when restoring stashed changes. Please resolve manually.', colors.yellow);
    }
  }

  log('🎉 Sync and patch process completed!', colors.green);
  console.log('');
  console.log('Summary:');
  console.log(`  - Version: ${version}`);
  console.log(`  - Branch: ${targetBranch}`);
  console.log('  - Fetched latest from upstream');
  console.log(`  - Merged upstream/main into ${targetBranch}`);
  console.log('  - Applied custom patches');
  console.log('');
  console.log(`To push changes to origin, run: git push origin ${targetBranch}`);
}

main().catch((error) => {
  log(`❌ Error: ${error.message}`, colors.red);
  process.exit(1);
});
