-- CreateTable
CREATE TABLE "Reminder" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "emailed" BOOLEAN NOT NULL DEFAULT true,
    "sentById" UUID,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_workspaceId_idx" ON "Reminder"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_requestId_kind_key" ON "Reminder"("requestId", "kind");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
