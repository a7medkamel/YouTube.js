# Sync and Patch Automation

This repository is a fork of [LuanRT/YouTube.js](https://github.com/LuanRT/YouTube.js) with custom patches applied.

## Branch Naming Convention

The scripts automatically create and maintain branches following the pattern `p{version}` where version comes from `package.json`. For example:
- Version `16.0.1` → Branch `p16.0.1`
- Version `17.2.0` → Branch `p17.2.0`

## Custom Patches

The following patches are automatically applied to maintain custom exports:

**src/Innertube.ts**:
- Import: `import { YTNode } from './parser/helpers.js';`
- Exports:
  ```typescript
  export const Patch = {
    HomeFeed,
    History,
    YTNode
  }

  export type P_YTNode = YTNode;
  ```

## Usage

Two scripts are provided to automate syncing with upstream and reapplying patches:

### Bash Script (Unix/Linux/macOS)

```bash
./sync-and-patch.sh
```

### Node.js Script (Cross-platform)

```bash
node sync-and-patch.cjs
# or
npm run sync-patch  # if added to package.json scripts
```

## What the Scripts Do

1. **Read version** - Gets the version from `package.json` to determine target branch (e.g., `p16.0.1`)
2. **Stash uncommitted changes** - Saves any work in progress
3. **Fetch from upstream** - Gets the latest changes from the original repository
4. **Create/switch to version branch** - Creates `p{version}` branch if it doesn't exist, or switches to it
5. **Merge changes** - If coming from another branch, merges your changes into the version branch
6. **Merge upstream/main** - Merges the latest changes into your version branch
7. **Apply patches** - Reapplies custom patches to maintain functionality
8. **Commit patches** - Commits the patches with message "export on latest"
9. **Restore stashed changes** - Brings back your work in progress

## Manual Sync (Alternative)

If you prefer to sync manually:

```bash
# Fetch and merge from upstream
git fetch upstream
git merge upstream/main

# Manually reapply patches to src/Innertube.ts
# 1. Add import after line with IBrowseResponse:
#    import { YTNode } from './parser/helpers.js';
# 2. Add exports at end of file:
#    export const Patch = { HomeFeed, History, YTNode }
#    export type P_YTNode = YTNode;

# Commit
git add src/Innertube.ts
git commit -m "export on latest"
```

## Adding to package.json

You can add the script to your package.json:

```json
{
  "scripts": {
    "sync-patch": "node sync-and-patch.cjs"
  }
}
```

Then run with:
```bash
npm run sync-patch
```

## How Branch Naming Works

The script reads the `version` field from `package.json` and creates/uses a branch with the `p` prefix:

```javascript
const version = packageJson.version;  // e.g., "16.0.1"
const targetBranch = `p${version}`;   // Results in "p16.0.1"
```

This ensures that each version of the upstream library has a corresponding patched branch in your fork.

## Workflow Example

Here's a typical workflow when upstream releases a new version:

1. Upstream releases version `16.0.1`
2. Update your `package.json` to version `16.0.1`
3. Run `./sync-and-patch.sh` or `node sync-and-patch.cjs`
4. Script automatically:
   - Creates branch `p16.0.1`
   - Merges from `upstream/main`
   - Applies your patches
   - Commits with "export on latest"
5. Push to your fork: `git push origin p16.0.1`

Your fork now has a patched version of `16.0.1` on the `p16.0.1` branch!

## Troubleshooting

### Merge Conflicts

If you encounter merge conflicts during the sync:

1. The script will stop and notify you
2. Resolve conflicts manually in the affected files
3. Run `git merge --continue`
4. The patches will need to be reapplied manually or by running the script again

### Upstream Remote Not Configured

If you see "upstream remote not configured", add it:

```bash
git remote add upstream https://github.com/LuanRT/YouTube.js.git
```

### Patches Not Applied

If patches aren't being applied:

1. Check that `src/Innertube.ts` exists
2. Verify the file structure matches expectations
3. Manually apply patches and update the script if needed
