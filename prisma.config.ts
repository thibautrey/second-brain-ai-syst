import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "backend/database/schemas/input-ingestion.prisma",
  migrations: {
    path: "backend/database/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Add shadowDatabaseUrl if you need shadow DB for migrations
    // shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});
