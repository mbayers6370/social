CREATE TABLE "OperatorAction" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "reportId" TEXT,
    "action" VARCHAR(32) NOT NULL,
    "targetId" TEXT NOT NULL,
    "note" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperatorAction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OperatorAction_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OperatorAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SafetyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OperatorAction_action_check" CHECK ("action" IN ('DISMISS', 'REMOVE_POST', 'REMOVE_MESSAGE', 'REMOVE_PHOTO', 'DEACTIVATE_ACCOUNT', 'EVENT_ADMIN_ASSIGN', 'EVENT_ADMIN_REMOVE'))
);
CREATE UNIQUE INDEX "OperatorAction_reportId_key" ON "OperatorAction"("reportId");
CREATE INDEX "OperatorAction_operatorId_createdAt_idx" ON "OperatorAction"("operatorId", "createdAt");
CREATE INDEX "SafetyReport_status_createdAt_id_idx" ON "SafetyReport"("status", "createdAt", "id");
-- The service supports received-message reports; the original constraint did not.
ALTER TABLE "SafetyReport" DROP CONSTRAINT "SafetyReport_targetKind_check";
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_targetKind_check"
    CHECK ("targetKind" IN ('profile', 'post', 'message'));

-- Legacy public-event roles were granted by arrival order or inherited implicitly.
-- Revoke those grants; founders must explicitly assign administrators through the audited workflow.
UPDATE "SpaceMembership" SET "role" = 'MEMBER'
WHERE "spaceId" IN (SELECT "id" FROM "Space" WHERE "kind" = 'EVENT');
