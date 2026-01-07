#!/bin/bash

# sync-and-patch.sh
# Automates pulling from upstream and reapplying custom patches

set -e  # Exit on error

echo "🔄 Starting sync and patch process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
TARGET_BRANCH="p${VERSION}"

echo "📦 Package version: $VERSION"
echo "🎯 Target branch: $TARGET_BRANCH"

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"

# Ensure we have upstream configured
if ! git remote | grep -q "^upstream$"; then
    echo -e "${RED}❌ Error: 'upstream' remote not configured${NC}"
    echo "Please add upstream with: git remote add upstream https://github.com/LuanRT/YouTube.js.git"
    exit 1
fi

# Stash any uncommitted changes
echo "💾 Stashing uncommitted changes..."
git stash push -u -m "Auto-stash before sync $(date +%Y-%m-%d_%H-%M-%S)"
STASH_RESULT=$?

# Fetch latest from upstream
echo "⬇️  Fetching from upstream..."
git fetch upstream

# Check if target branch exists, create or switch to it
if git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
    echo "🔀 Branch $TARGET_BRANCH already exists, switching to it..."
    git checkout "$TARGET_BRANCH"
else
    echo "🌿 Creating new branch $TARGET_BRANCH from upstream/main..."
    git checkout -b "$TARGET_BRANCH" upstream/main
fi

# If we were on a different branch and it's not main, offer to merge changes
if [ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ] && [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠️  You were on branch: $CURRENT_BRANCH${NC}"
    echo "Merging changes from $CURRENT_BRANCH into $TARGET_BRANCH..."
    if git merge "$CURRENT_BRANCH" --no-edit; then
        echo -e "${GREEN}✅ Merge from $CURRENT_BRANCH successful${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not merge from $CURRENT_BRANCH, continuing...${NC}"
    fi
fi

# Merge upstream changes
echo "🔀 Merging upstream/main into $TARGET_BRANCH..."
if git merge upstream/main --no-edit; then
    echo -e "${GREEN}✅ Merge successful${NC}"
else
    echo -e "${RED}❌ Merge conflict detected${NC}"
    echo "Please resolve conflicts manually, then run: git merge --continue"
    exit 1
fi

# Apply patches
echo "🔧 Applying custom patches..."

# Patch 1: Add YTNode import and custom exports to Innertube.ts
INNERTUBE_FILE="src/Innertube.ts"

if [ ! -f "$INNERTUBE_FILE" ]; then
    echo -e "${RED}❌ Error: $INNERTUBE_FILE not found${NC}"
    exit 1
fi

# Check if patches are already applied
if grep -q "export const Patch" "$INNERTUBE_FILE"; then
    echo -e "${YELLOW}⚠️  Patches already applied to $INNERTUBE_FILE${NC}"
else
    echo "📝 Applying patches to $INNERTUBE_FILE..."

    # Check if YTNode import exists
    if ! grep -q "import { YTNode } from './parser/helpers.js';" "$INNERTUBE_FILE"; then
        # Find the line with IBrowseResponse import and add YTNode import after it
        if grep -q "import type { IBrowseResponse, IParsedResponse } from './parser/index.js';" "$INNERTUBE_FILE"; then
            sed -i '' "/import type { IBrowseResponse, IParsedResponse } from '.\/parser\/index.js';/a\\
import { YTNode } from './parser/helpers.js';
" "$INNERTUBE_FILE"
            echo "  ✓ Added YTNode import"
        fi
    fi

    # Add custom exports at the end of the file
    cat >> "$INNERTUBE_FILE" << 'EOF'

export const Patch = {
  HomeFeed,
  History,
  YTNode
}

export type P_YTNode = YTNode;
EOF
    echo "  ✓ Added custom exports"
    echo -e "${GREEN}✅ Patches applied successfully${NC}"
fi

# Commit patches if there are changes
if ! git diff --quiet; then
    echo "💾 Committing patches..."
    git add "$INNERTUBE_FILE"
    git commit -m "export on latest"
    echo -e "${GREEN}✅ Patches committed${NC}"
else
    echo "✨ No changes to commit"
fi

# Pop stashed changes if any were stashed
if [ $STASH_RESULT -eq 0 ]; then
    STASH_COUNT=$(git stash list | wc -l)
    if [ $STASH_COUNT -gt 0 ]; then
        echo "📤 Restoring stashed changes..."
        if git stash pop; then
            echo -e "${GREEN}✅ Stashed changes restored${NC}"
        else
            echo -e "${YELLOW}⚠️  Conflicts when restoring stashed changes. Please resolve manually.${NC}"
        fi
    fi
fi

echo -e "${GREEN}🎉 Sync and patch process completed!${NC}"
echo ""
echo "Summary:"
echo "  - Version: $VERSION"
echo "  - Branch: $TARGET_BRANCH"
echo "  - Fetched latest from upstream"
echo "  - Merged upstream/main into $TARGET_BRANCH"
echo "  - Applied custom patches"
echo ""
echo "To push changes to origin, run: git push origin $TARGET_BRANCH"
