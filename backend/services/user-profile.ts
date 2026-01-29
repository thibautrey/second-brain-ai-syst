/**
 * User Profile Service
 *
 * Manages the user's structural profile information that should be passed
 * as context to the LLM without needing memory search.
 *
 * The profile contains important facts about the user such as:
 * - Personal info (name, age, location)
 * - Preferences (communication style, interests)
 * - Professional info (job, company, skills)
 * - Goals and objectives
 * - Important relationships
 * - Any other structural information the LLM determines is important
 *
 * The LLM is responsible for maintaining this profile through the
 * update_user_profile tool.
 */

import prisma from "./prisma.js";

/**
 * Default profile structure (empty)
 * The LLM will populate this as it learns about the user
 */
export interface UserProfile {
  // Personal Information
  name?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  age?: number;
  birthdate?: string;
  location?: string;
  timezone?: string;
  language?: string;

  // Professional Information
  occupation?: string;
  company?: string;
  industry?: string;
  skills?: string[];
  workStyle?: string;

  // Preferences
  communicationStyle?: string;
  preferredName?: string; // How they want to be addressed
  interests?: string[];
  hobbies?: string[];

  // Goals & Objectives
  currentGoals?: string[];
  longTermGoals?: string[];

  // Relationships (key people in their life)
  relationships?: {
    name: string;
    relation: string; // e.g., "wife", "colleague", "friend"
    notes?: string;
  }[];

  // Health & Lifestyle (if shared)
  dietaryPreferences?: string;
  exerciseHabits?: string;
  sleepSchedule?: string;

  // Custom fields - anything else the LLM determines is important
  custom?: Record<string, any>;

  // Metadata
  lastUpdated?: string;
}

/**
 * Ensure UserSettings exists for a user (auto-create if missing)
 * This is called on-the-fly when needed, so brand new users don't crash
 */
export async function ensureUserSettings(userId: string): Promise<void> {
  console.log(`[User Profile] [ensureUserSettings] START: userId=${userId}`);
  try {
    // Check if user exists first
    console.log(
      `[User Profile] [ensureUserSettings] Checking if user exists...`,
    );
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      console.warn(
        `[User Profile] [ensureUserSettings] User not found: ${userId}`,
      );
      return;
    }
    console.log(`[User Profile] [ensureUserSettings] User found: ${userId}`);

    // Check if settings exist
    console.log(
      `[User Profile] [ensureUserSettings] Checking if settings exist...`,
    );
    const existingSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existingSettings) {
      console.log(
        `[User Profile] [ensureUserSettings] Settings already exist for ${userId}`,
      );
      return;
    }

    // If not, create them with defaults
    console.log(
      `[User Profile] [ensureUserSettings] Creating new UserSettings for: ${userId}`,
    );
    const created = await prisma.userSettings.create({
      data: {
        userId,
        userProfile: {} as any,
        metadata: {} as any,
      },
    });
    console.log(
      `[User Profile] [ensureUserSettings] Successfully created UserSettings with id: ${created.id}`,
    );
  } catch (error: any) {
    console.error(
      `[User Profile] [ensureUserSettings] ERROR for ${userId}:`,
      error.message,
      error.stack,
    );
    // Don't throw - we want to continue gracefully
  }
  console.log(`[User Profile] [ensureUserSettings] DONE`);
}

/**
 * Get user profile
 * Auto-initializes UserSettings if missing (brand new users)
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  console.log(`[User Profile] [getUserProfile] START: userId=${userId}`);
  try {
    // Ensure settings exist first (auto-create if needed)
    console.log(
      `[User Profile] [getUserProfile] Ensuring UserSettings exists...`,
    );
    await ensureUserSettings(userId);
    console.log(`[User Profile] [getUserProfile] UserSettings ensured`);

    console.log(
      `[User Profile] [getUserProfile] Fetching userSettings from DB...`,
    );
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { userProfile: true },
    });
    console.log(
      `[User Profile] [getUserProfile] Settings found: ${!!settings}, has userProfile: ${!!settings?.userProfile}`,
    );

    if (!settings?.userProfile) {
      console.log(
        `[User Profile] [getUserProfile] No userProfile found, returning empty object`,
      );
      return {};
    }

    // Handle the case where userProfile is stored as a Prisma JSON value
    const profile = settings.userProfile as unknown;
    console.log(
      `[User Profile] [getUserProfile] Profile type: ${typeof profile}, is object: ${typeof profile === "object" && profile !== null}`,
    );
    if (typeof profile === "object" && profile !== null) {
      console.log(`[User Profile] [getUserProfile] Returning profile`);
      return profile as UserProfile;
    }

    console.log(
      `[User Profile] [getUserProfile] Returning empty object (invalid profile type)`,
    );
    return {};
  } catch (error: any) {
    console.error(
      `[User Profile] [getUserProfile] ERROR for ${userId}:`,
      error.message,
      error.stack,
    );
    return {};
  }
}

/**
 * Update user profile (full replacement)
 */
export async function updateUserProfile(
  userId: string,
  profile: UserProfile,
): Promise<UserProfile> {
  // Add lastUpdated timestamp
  const updatedProfile = {
    ...profile,
    lastUpdated: new Date().toISOString(),
  };

  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      userProfile: updatedProfile as any,
    },
    update: {
      userProfile: updatedProfile as any,
    },
  });

  return updatedProfile;
}

/**
 * Merge updates into existing profile
 * This is the main method used by the LLM tool
 * Automatically initializes UserSettings if missing
 */
export async function mergeUserProfile(
  userId: string,
  updates: Partial<UserProfile>,
): Promise<UserProfile> {
  console.log(`[User Profile] [mergeUserProfile] START: userId=${userId}`);
  console.log(
    `[User Profile] [mergeUserProfile] Updates:`,
    JSON.stringify(updates),
  );
  try {
    // Ensure settings exist first (auto-create if brand new user)
    console.log(
      `[User Profile] [mergeUserProfile] Ensuring UserSettings exists...`,
    );
    await ensureUserSettings(userId);
    console.log(`[User Profile] [mergeUserProfile] UserSettings ensured`);

    console.log(`[User Profile] [mergeUserProfile] Getting current profile...`);
    const currentProfile = await getUserProfile(userId);
    console.log(
      `[User Profile] [mergeUserProfile] Current profile:`,
      JSON.stringify(currentProfile),
    );

    // Deep merge for nested objects like relationships
    const mergedProfile: UserProfile = {
      ...currentProfile,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    // Handle relationships merging (add/update, don't replace all)
    if (updates.relationships && currentProfile.relationships) {
      const existingRelationships = currentProfile.relationships;
      const newRelationships = updates.relationships;

      // Merge by name - update existing or add new
      const relationshipsMap = new Map(
        existingRelationships.map((r) => [r.name.toLowerCase(), r]),
      );

      for (const rel of newRelationships) {
        relationshipsMap.set(rel.name.toLowerCase(), rel);
      }

      mergedProfile.relationships = Array.from(relationshipsMap.values());
    }

    // Handle arrays merging (skills, interests, goals) - add unique values
    const arrayFields: (keyof UserProfile)[] = [
      "skills",
      "interests",
      "hobbies",
      "currentGoals",
      "longTermGoals",
    ];

    for (const field of arrayFields) {
      const currentValues = currentProfile[field] as string[] | undefined;
      const newValues = updates[field] as string[] | undefined;

      if (newValues && Array.isArray(newValues)) {
        const combined = [...(currentValues || []), ...newValues];
        // Remove duplicates (case-insensitive)
        const uniqueMap = new Map(combined.map((v) => [v.toLowerCase(), v]));
        (mergedProfile as any)[field] = Array.from(uniqueMap.values());
      }
    }

    // Handle custom fields merging
    if (updates.custom && currentProfile.custom) {
      mergedProfile.custom = {
        ...currentProfile.custom,
        ...updates.custom,
      };
    }

    console.log(`[User Profile] [mergeUserProfile] Performing upsert...`);
    console.log(
      `[User Profile] [mergeUserProfile] Merged profile:`,
      JSON.stringify(mergedProfile),
    );
    const result = await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        userProfile: mergedProfile as any,
        metadata: {} as any,
      },
      update: {
        userProfile: mergedProfile as any,
      },
    });
    console.log(
      `[User Profile] [mergeUserProfile] Upsert successful. Settings id: ${result.id}`,
    );

    console.log(`[User Profile] [mergeUserProfile] Returning merged profile`);
    return mergedProfile;
  } catch (error: any) {
    console.error(
      `[User Profile] [mergeUserProfile] ERROR for ${userId}:`,
      error.message,
      error.stack,
    );
    throw error;
  }
}

/**
 * Delete specific fields from profile
 */
export async function deleteProfileFields(
  userId: string,
  fields: (keyof UserProfile)[],
): Promise<UserProfile> {
  console.log(
    `[User Profile] [deleteProfileFields] START: userId=${userId}, fields=[${fields.join(",")}]`,
  );
  try {
    console.log(
      `[User Profile] [deleteProfileFields] Getting current profile...`,
    );
    const currentProfile = await getUserProfile(userId);
    console.log(
      `[User Profile] [deleteProfileFields] Current profile:`,
      JSON.stringify(currentProfile),
    );

    console.log(`[User Profile] [deleteProfileFields] Deleting fields...`);
    for (const field of fields) {
      console.log(
        `[User Profile] [deleteProfileFields] Deleting field: ${String(field)}`,
      );
      delete currentProfile[field];
    }

    currentProfile.lastUpdated = new Date().toISOString();
    console.log(
      `[User Profile] [deleteProfileFields] Updated profile:`,
      JSON.stringify(currentProfile),
    );

    console.log(`[User Profile] [deleteProfileFields] Updating in DB...`);
    const result = await prisma.userSettings.update({
      where: { userId },
      data: {
        userProfile: currentProfile as any,
      },
    });
    console.log(
      `[User Profile] [deleteProfileFields] Update successful. Settings id: ${result.id}`,
    );

    return currentProfile;
  } catch (error: any) {
    console.error(
      `[User Profile] [deleteProfileFields] ERROR for ${userId}:`,
      error.message,
      error.stack,
    );
    throw error;
  }
}

/**
 * Format user profile for injection into LLM prompt
 */
export function formatProfileForPrompt(profile: UserProfile): string {
  if (!profile || Object.keys(profile).length === 0) {
    return "";
  }

  const parts: string[] = [];

  // Personal info
  if (profile.name || profile.firstName) {
    const name = profile.preferredName || profile.name || profile.firstName;
    parts.push(`Nom: ${name}`);
  }

  if (profile.location) {
    parts.push(`Localisation: ${profile.location}`);
  }

  if (profile.timezone) {
    parts.push(`Fuseau horaire: ${profile.timezone}`);
  }

  if (profile.language) {
    parts.push(`Langue préférée: ${profile.language}`);
  }

  // Professional
  if (profile.occupation) {
    const professional = profile.company
      ? `${profile.occupation} chez ${profile.company}`
      : profile.occupation;
    parts.push(`Profession: ${professional}`);
  }

  if (profile.skills && profile.skills.length > 0) {
    parts.push(`Compétences: ${profile.skills.join(", ")}`);
  }

  // Preferences
  if (profile.interests && profile.interests.length > 0) {
    parts.push(`Intérêts: ${profile.interests.join(", ")}`);
  }

  if (profile.hobbies && profile.hobbies.length > 0) {
    parts.push(`Hobbies: ${profile.hobbies.join(", ")}`);
  }

  if (profile.communicationStyle) {
    parts.push(`Style de communication préféré: ${profile.communicationStyle}`);
  }

  // Goals
  if (profile.currentGoals && profile.currentGoals.length > 0) {
    parts.push(`Objectifs actuels: ${profile.currentGoals.join(", ")}`);
  }

  // Relationships
  if (profile.relationships && profile.relationships.length > 0) {
    const relationsStr = profile.relationships
      .map((r) => `${r.name} (${r.relation})`)
      .join(", ");
    parts.push(`Proches: ${relationsStr}`);
  }

  // Custom fields
  if (profile.custom) {
    for (const [key, value] of Object.entries(profile.custom)) {
      if (value !== null && value !== undefined) {
        parts.push(
          `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`,
        );
      }
    }
  }

  if (parts.length === 0) {
    return "";
  }

  return `[Profil utilisateur]\n${parts.join("\n")}`;
}

/**
 * Get all languages the user has trained on by examining their voice samples
 * Returns unique language codes in ISO 639-1 format
 */
export async function getTrainedLanguages(userId: string): Promise<string[]> {
  const voiceSamples = await prisma.voiceSample.findMany({
    where: {
      speakerProfile: {
        userId,
      },
    },
    select: {
      language: true,
    },
    distinct: ["language"],
  });

  // Extract and return unique language codes, filtering out null/undefined
  const languages = voiceSamples
    .map((sample) => sample.language)
    .filter((lang): lang is string => !!lang)
    .sort();

  return [...new Set(languages)]; // Remove any duplicates
}

// Export singleton-style functions
export const userProfileService = {
  ensureUserSettings,
  getUserProfile,
  updateUserProfile,
  mergeUserProfile,
  deleteProfileFields,
  formatProfileForPrompt,
  getTrainedLanguages,
};

export default userProfileService;
