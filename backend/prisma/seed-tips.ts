import prisma from "../services/prisma.js";

/**
 * Seed default tips for all users
 * This script creates initial tips that are shown to users
 */
async function seedDefaultTips() {
  console.log("🌱 Seeding default tips...");

  const defaultTips = [
    {
      title: "Welcome to Second Brain",
      description: "Your personal AI system is here to help you capture and organize your thoughts.",
      category: "getting-started",
      targetFeature: "dashboard",
      priority: 100,
      icon: "lightbulb",
    },
    {
      title: "Voice Training for Better Recognition",
      description: "Train the system with your voice patterns to improve accuracy. Visit the Voice Training section.",
      category: "feature-highlight",
      targetFeature: "training",
      priority: 80,
      icon: "rocket",
    },
    {
      title: "Use Memories to Remember",
      description: "Browse your memories to see how the system organizes what you've shared with it.",
      category: "feature-highlight",
      targetFeature: "memories",
      priority: 70,
      icon: "star",
    },
    {
      title: "Tools Extend Your Capabilities",
      description: "Configure and use tools to extend the system's functionality for your workflow.",
      category: "feature-highlight",
      targetFeature: "tools",
      priority: 60,
      icon: "zap",
    },
    {
      title: "Organize Tasks with Todo Lists",
      description: "Create and manage your tasks efficiently with the built-in todo system.",
      category: "productivity",
      targetFeature: "todos",
      priority: 50,
      icon: "lightbulb",
    },
    {
      title: "Schedule Your Reminders",
      description: "Set up scheduled tasks and reminders to keep you on track.",
      category: "productivity",
      targetFeature: "schedule",
      priority: 45,
      icon: "star",
    },
    {
      title: "Review Notifications",
      description: "Check your notifications to stay updated with important system events and suggestions.",
      category: "feature-highlight",
      targetFeature: "notifications",
      priority: 40,
      icon: "zap",
    },
    {
      title: "Connect a notification channel",
      description:
        "Open the Notification tab to link Telegram, Pushover, or another interaction channel so alerts reach you where you already spend time.",
      category: "notifications",
      targetFeature: "notifications",
      priority: 38,
      icon: "message-circle",
    },
    {
      title: "Customize Your Settings",
      description: "Personalize your experience in the Settings section to match your preferences.",
      category: "getting-started",
      targetFeature: "settings",
      priority: 35,
      icon: "lightbulb",
    },
  ];

  // Get all users and assign tips to them
  const users = await prisma.user.findMany();

  for (const user of users) {
    // Check if user already has tips
    const existingTips = await prisma.tip.count({
      where: { userId: user.id },
    });

    if (existingTips === 0) {
      // Create default tips for this user
      for (const tip of defaultTips) {
        await prisma.tip.create({
          data: {
            userId: user.id,
            ...tip,
          },
        });
      }
      console.log(`✅ Created ${defaultTips.length} tips for user ${user.email}`);
    } else {
      console.log(`⏭️  User ${user.email} already has tips, skipping...`);
    }
  }

  console.log("✨ Seeding complete!");
}

// Run the seed
seedDefaultTips()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
