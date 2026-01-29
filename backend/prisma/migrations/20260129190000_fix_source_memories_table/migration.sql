-- Fix the SourceMemories relationship table name
-- Drop the incorrectly named table
DROP TABLE IF EXISTS "_MemoriesSummaries" CASCADE;

-- Create the correctly named table with the proper foreign key relationship
CREATE TABLE "_SourceMemories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Create unique index to ensure no duplicates
CREATE UNIQUE INDEX "_SourceMemories_AB_unique" ON "_SourceMemories"("A", "B");

-- Create index on B for efficient queries
CREATE INDEX "_SourceMemories_B_index" ON "_SourceMemories"("B");

-- Add foreign key constraints
ALTER TABLE "_SourceMemories" ADD CONSTRAINT "_SourceMemories_A_fkey" FOREIGN KEY ("A") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_SourceMemories" ADD CONSTRAINT "_SourceMemories_B_fkey" FOREIGN KEY ("B") REFERENCES "summaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
