-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'JPEG', 'PNG', 'HEIC');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SENT', 'IN_PROGRESS', 'COMPLETE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "requestId" UUID;

-- CreateTable
CREATE TABLE "Template" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateItem" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "helpText" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "allowedTypes" "FileType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "createdById" UUID,
    "checklistName" TEXT NOT NULL DEFAULT '',
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "dueDate" DATE,
    "message" TEXT NOT NULL DEFAULT '',
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "linkHash" TEXT,
    "linkExpiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "filesDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestItem" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "helpText" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "allowedTypes" "FileType"[],
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_workspaceId_idx" ON "Template"("workspaceId");

-- CreateIndex
CREATE INDEX "TemplateItem_templateId_idx" ON "TemplateItem"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "Request_linkHash_key" ON "Request"("linkHash");

-- CreateIndex
CREATE INDEX "Request_workspaceId_status_idx" ON "Request"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Request_workspaceId_createdAt_idx" ON "Request"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Request_workspaceId_dueDate_idx" ON "Request"("workspaceId", "dueDate");

-- CreateIndex
CREATE INDEX "Request_createdById_idx" ON "Request"("createdById");

-- CreateIndex
CREATE INDEX "RequestItem_requestId_idx" ON "RequestItem"("requestId");

-- CreateIndex
CREATE INDEX "RequestItem_workspaceId_status_idx" ON "RequestItem"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateItem" ADD CONSTRAINT "TemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
