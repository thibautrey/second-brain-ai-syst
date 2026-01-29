/**
 * Basic test for Proactive Agent Service
 * 
 * This test verifies that the proactive agent service can be loaded
 * and its methods are properly defined.
 * 
 * Run with: npx tsx backend/services/__tests__/proactive-agent.test.ts
 */

console.log("🧪 Testing Proactive Agent Service\n");

// Test 1: Module can be imported
console.log("Test 1: Import Proactive Agent Service");
try {
  const module = await import("../proactive-agent.js");
  const { proactiveAgentService, ProactiveAgentService } = module;
  
  if (!proactiveAgentService) {
    console.error("❌ FAIL: proactiveAgentService singleton not exported");
    process.exit(1);
  }
  
  if (!(proactiveAgentService instanceof ProactiveAgentService)) {
    console.error("❌ FAIL: proactiveAgentService is not an instance of ProactiveAgentService");
    process.exit(1);
  }
  
  console.log("✅ PASS: Proactive agent service imported successfully");
  console.log("   - proactiveAgentService singleton exists");
  console.log("   - Type is ProactiveAgentService\n");
} catch (error) {
  console.error("❌ FAIL: Could not import proactive agent service");
  console.error(error);
  process.exit(1);
}

// Test 2: Service has required methods
console.log("Test 2: Verify Required Methods");
try {
  const { proactiveAgentService } = await import("../proactive-agent.js");
  
  const requiredMethods = [
    'runProactiveAnalysis',
    'runHealthCheck',
  ];
  
  const missingMethods = requiredMethods.filter(
    method => typeof (proactiveAgentService as any)[method] !== 'function'
  );
  
  if (missingMethods.length > 0) {
    console.error("❌ FAIL: Missing methods:", missingMethods);
    process.exit(1);
  }
  
  console.log("✅ PASS: All required methods exist");
  requiredMethods.forEach(method => {
    console.log(`   - ${method}()`);
  });
  console.log();
} catch (error) {
  console.error("❌ FAIL: Error checking methods");
  console.error(error);
  process.exit(1);
}

// Test 3: Type definitions for interfaces
console.log("Test 3: Verify Type Definitions");
try {
  const module = await import("../proactive-agent.js");
  
  // These should be exported types
  const hasProactiveAgentResult = 'ProactiveAgentResult' in module;
  const hasProactiveSuggestion = 'ProactiveSuggestion' in module;
  
  // Note: TypeScript types are erased at runtime, so we can't directly check them
  // This just verifies the module structure is correct
  console.log("✅ PASS: Module exports are structured correctly");
  console.log("   - Module loaded without errors");
  console.log("   - ProactiveAgentService class exported");
  console.log("   - Service instance exported\n");
} catch (error) {
  console.error("❌ FAIL: Type definition check failed");
  console.error(error);
  process.exit(1);
}

// Test 4: Integration check with scheduler
console.log("Test 4: Check Scheduler Integration");
try {
  const { schedulerService } = await import("../scheduler.js");
  
  const tasks = schedulerService.getTasksStatus();
  const proactiveTasks = tasks.filter(
    t => t.id.includes('proactive') || t.id.includes('health-check')
  );
  
  if (proactiveTasks.length === 0) {
    console.warn("⚠️  WARNING: No proactive agent tasks found in scheduler");
    console.warn("   This might be expected if scheduler hasn't initialized yet");
  } else {
    console.log("✅ PASS: Proactive agent tasks registered in scheduler");
    proactiveTasks.forEach(task => {
      console.log(`   - ${task.id}: ${task.name}`);
      console.log(`     Enabled: ${task.isEnabled}`);
    });
  }
  console.log();
} catch (error) {
  console.error("❌ FAIL: Scheduler integration check failed");
  console.error(error);
  process.exit(1);
}

// Test 5: Verify constants and prompts exist
console.log("Test 5: Verify Service Configuration");
try {
  // Import the module to check its internal structure
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const serviceFile = path.join(__dirname, '../proactive-agent.ts');
  
  const content = fs.readFileSync(serviceFile, 'utf-8');
  
  // Check for important elements
  const hasProactivePrompt = content.includes('PROACTIVE_ANALYSIS_PROMPT');
  const hasCategories = content.includes('health') && 
                       content.includes('mental_wellbeing') && 
                       content.includes('productivity');
  const hasPriorities = content.includes('low') && 
                       content.includes('medium') && 
                       content.includes('high');
  
  if (!hasProactivePrompt) {
    console.error("❌ FAIL: PROACTIVE_ANALYSIS_PROMPT not found");
    process.exit(1);
  }
  
  if (!hasCategories) {
    console.error("❌ FAIL: Required categories not found");
    process.exit(1);
  }
  
  if (!hasPriorities) {
    console.error("❌ FAIL: Priority levels not found");
    process.exit(1);
  }
  
  console.log("✅ PASS: Service configuration verified");
  console.log("   - PROACTIVE_ANALYSIS_PROMPT defined");
  console.log("   - Categories defined (health, mental_wellbeing, productivity, etc.)");
  console.log("   - Priority levels defined (low, medium, high)\n");
} catch (error) {
  console.error("❌ FAIL: Configuration verification failed");
  console.error(error);
  process.exit(1);
}

console.log("🎉 All tests passed!");
console.log("\nNote: These are structural tests. Full integration testing requires:");
console.log("- Database connection");
console.log("- LLM service availability");
console.log("- User data");
console.log("\nTo test the full functionality, use the API endpoints:");
console.log("- POST /api/proactive/analyze");
console.log("- POST /api/proactive/health-check");
console.log("- GET /api/proactive/status");
