-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Export" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "createdById" UUID,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "wrappedKey" TEXT,
    "iv" TEXT,
    "authTag" TEXT,
    "size" INTEGER,
    "fileCount" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Export_storageKey_key" ON "Export"("storageKey");

-- CreateIndex
CREATE INDEX "Export_requestId_idx" ON "Export"("requestId");

-- CreateIndex
CREATE INDEX "Export_workspaceId_idx" ON "Export"("workspaceId");

-- CreateIndex
CREATE INDEX "Export_status_expiresAt_idx" ON "Export"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
