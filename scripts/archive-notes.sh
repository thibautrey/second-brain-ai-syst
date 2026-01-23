#!/bin/bash

# Archive Implementation Notes Script
# This script helps archive completed implementation notes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

IMPL_NOTES_DIR="docs/implementation-notes"

echo -e "${BLUE}=== Implementation Notes Archiver ===${NC}\n"

# List current implementation notes
echo -e "${YELLOW}Current implementation notes:${NC}"
ls -1 "$IMPL_NOTES_DIR"/*.md | grep -v README | sed 's|.*/||' | nl

echo -e "\n${YELLOW}Usage:${NC}"
echo -e "  ${BLUE}./scripts/archive-notes.sh list${NC}       - List all implementation notes"
echo -e "  ${BLUE}./scripts/archive-notes.sh move <file>${NC} - Move note to permanent docs (not yet implemented)"
echo -e "  ${BLUE}./scripts/archive-notes.sh rm <file>${NC}   - Remove obsolete note (not yet implemented)"

echo -e "\n${YELLOW}Guidelines for archiving:${NC}"
echo -e "  1. Feature should be production-ready and tested"
echo -e "  2. Important info should be in /docs/ permanent documentation"
echo -e "  3. Remove the file from /docs/implementation-notes/"
echo -e "  4. Commit with message: 'Archive: Move FEATURE to permanent docs'"

echo -e "\n${YELLOW}Example workflow:${NC}"
echo -e "  1. Copy essential content from:"
echo -e "     ${BLUE}/docs/implementation-notes/FEATURE_IMPLEMENTATION.md${NC}"
echo -e "  2. Consolidate into:"
echo -e "     ${BLUE}/docs/feature.md${NC}"
echo -e "  3. Delete the implementation note:"
echo -e "     ${BLUE}git rm docs/implementation-notes/FEATURE_IMPLEMENTATION.md${NC}"
echo -e "  4. Commit the changes"

echo -e "\n${GREEN}Done!${NC}"
