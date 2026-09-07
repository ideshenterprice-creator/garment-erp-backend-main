-- Normalize empty lot numbers so they do not collide on the unique index
UPDATE "Operation"
SET "lotNo" = NULL
WHERE "lotNo" IS NOT NULL AND BTRIM("lotNo") = '';

-- Keep the earliest row for each lot number; suffix later duplicates
WITH ranked AS (
  SELECT
    id,
    "lotNo",
    ROW_NUMBER() OVER (
      PARTITION BY LOWER("lotNo")
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Operation"
  WHERE "lotNo" IS NOT NULL
)
UPDATE "Operation" AS o
SET "lotNo" = o."lotNo" || '-' || r.rn
FROM ranked AS r
WHERE o.id = r.id AND r.rn > 1;

-- Keep the earliest designation name; suffix later duplicates
WITH ranked AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(name)
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Designation"
)
UPDATE "Designation" AS d
SET name = d.name || ' (' || r.rn || ')'
FROM ranked AS r
WHERE d.id = r.id AND r.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "Operation_lotNo_key" ON "Operation"("lotNo");

-- CreateIndex
CREATE UNIQUE INDEX "Designation_name_key" ON "Designation"("name");

-- DropIndex (unique already covers name lookups)
DROP INDEX IF EXISTS "Designation_name_idx";
