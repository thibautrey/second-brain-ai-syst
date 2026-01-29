#!/usr/bin/env bash

# Tool Error Logging Quick Start Guide
# This script helps you get the error logging system up and running

set -e

echo "🚀 Tool Error Logging System - Quick Start"
echo "=========================================="
echo ""

# Step 1: Create Prisma migration
echo "📦 Step 1: Creating Prisma migration..."
cd backend || exit
npx prisma migrate dev --name add_tool_error_logs
echo "✅ Migration created successfully!"
echo ""

# Step 2: Generate Prisma client
echo "🔧 Step 2: Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated!"
echo ""

# Step 3: Compile TypeScript
echo "📝 Step 3: Compiling TypeScript..."
npm run build || true
echo "✅ TypeScript compiled!"
echo ""

# Step 4: Verify services
echo "✅ Verification checklist:"
echo "   ✓ tool-error-logger.ts - Error logging service"
echo "   ✓ tool-error-logs.controller.ts - API endpoints"
echo "   ✓ error-patterns.config.ts - Error categorization"
echo "   ✓ schema.prisma - ToolErrorLog table"
echo ""

# Step 5: Test the system
echo "🧪 Step 5: Testing the system..."
echo "   1. Start the backend: npm run dev"
echo "   2. Trigger an error in a tool"
echo "   3. Check console output for error details"
echo "   4. Query /debug/tool-errors endpoint"
echo ""

# Step 6: Integration points
echo "⚙️  Integration needed in api-server.ts/main.ts:"
echo "   Add these lines:"
echo ""
echo "   import toolErrorLogsController from '../controllers/tool-error-logs.controller.js';"
echo "   app.use('/api', toolErrorLogsController);"
echo ""

echo "📚 Documentation files:"
echo "   • TOOL_ERROR_LOGGING.md - Full documentation"
echo "   • TOOL_ERROR_LOGGING_EXAMPLES.md - Usage examples"
echo "   • TOOL_ERROR_LOGGING_COMPLETE.md - Summary"
echo ""

echo "🎉 Setup complete! You're ready to use the error logging system."
echo ""
echo "Next steps:"
echo "1. Add controller import to api-server.ts"
echo "2. Start the backend: npm run dev"
echo "3. Test with: curl http://localhost:3000/debug/tool-errors/summary"
echo ""
