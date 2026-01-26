/**
 * Test script for the notification system
 *
 * Run with: node --loader ts-node/esm test-notifications.ts
 */

import { notificationService } from "./services/notification";

async function testNotificationSystem() {
  console.log("🧪 Testing Notification System...\n");

  try {
    // Test 1: Create a simple notification
    console.log("Test 1: Creating a simple INFO notification...");
    const notification1 = await notificationService.createNotification({
      userId: "test-user-123",
      title: "Test Notification",
      message: "This is a test notification",
      type: "INFO",
    });
    console.log("✅ Created:", notification1.notification?.id);

    // Test 2: Create a success notification with action
    console.log("\nTest 2: Creating a SUCCESS notification with action...");
    const notification2 = await notificationService.createNotification({
      userId: "test-user-123",
      title: "Task Completed",
      message: "Your daily summary has been generated",
      type: "SUCCESS",
      actionUrl: "/dashboard/summaries",
      actionLabel: "View Summary",
      sourceType: "summary",
      sourceId: "summary-123",
    });
    console.log("✅ Created:", notification2.notification?.id);

    // Test 3: Create a scheduled notification
    console.log("\nTest 3: Creating a scheduled notification...");
    const scheduledTime = new Date(Date.now() + 5000); // +5 seconds
    const notification3 = await notificationService.createNotification({
      userId: "test-user-123",
      title: "Reminder",
      message: "This notification was scheduled",
      type: "REMINDER",
      scheduledFor: scheduledTime,
    });
    console.log(
      "✅ Created (scheduled for:",
      scheduledTime.toISOString(),
      "):",
      notification3.notification?.id,
    );

    // Test 4: List notifications
    console.log("\nTest 4: Listing user notifications...");
    const list =
      await notificationService.getUserNotifications("test-user-123");
    console.log(`✅ Found ${list.notifications.length} notifications`);

    // Test 5: Mark as read
    console.log("\nTest 5: Marking notification as read...");
    await notificationService.markAsRead(notification1.notification?.id, "test-user-123");
    console.log("✅ Marked as read:", notification1.notification?.id);

    // Test 6: Process scheduled notifications
    console.log(
      "\nTest 6: Waiting 6 seconds and processing scheduled notifications...",
    );
    await new Promise((resolve) => setTimeout(resolve, 6000));
    const processedCount =
      await notificationService.processScheduledNotifications();
    console.log(`✅ Processed ${processedCount} scheduled notifications`);

    console.log("\n✨ All tests passed!");
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run tests
testNotificationSystem();
