#!/bin/bash

# Check that implementation notes are in the right location
# This script validates that temporary markdown files follow the organization rule

ERRORS=0

# Files that should NEVER be at root
TEMP_FILES_AT_ROOT=$(find . -maxdepth 1 -name "*.md" -type f | grep -v "README.md" | grep -v "SETUP.md" | grep -v "SECURITY.md" | grep -v "QUICK_REFERENCE.md" | grep -v "TESTING_GUIDE.md" | grep -v "agents.md")

if [ ! -z "$TEMP_FILES_AT_ROOT" ]; then
    echo "❌ ERROR: Temporary markdown files found at root level!"
    echo "These should be in /docs/implementation-notes/:"
    echo "$TEMP_FILES_AT_ROOT"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Root directory is clean - only essential markdown files"
fi

# Check that implementation notes exist
if [ -d "docs/implementation-notes" ]; then
    NOTE_COUNT=$(ls -1 docs/implementation-notes/*.md 2>/dev/null | wc -l)
    echo "✅ Found $NOTE_COUNT implementation notes in /docs/implementation-notes/"
else
    echo "❌ ERROR: /docs/implementation-notes/ directory not found!"
    ERRORS=$((ERRORS + 1))
fi

# Check agents.md has the golden rule
if grep -q "🚫 NEVER create markdown files at root for implementation/debug" agents.md; then
    echo "✅ agents.md contains clear instructions"
else
    echo "⚠️  WARNING: agents.md may need to be updated with clearer instructions"
fi

if [ $ERRORS -eq 0 ]; then
    echo ""
    echo "✅ All checks passed - documentation is properly organized!"
    exit 0
else
    echo ""
    echo "❌ $ERRORS error(s) found - please review"
    exit 1
fi
