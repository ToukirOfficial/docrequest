-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'SKIPPED');

-- CreateTable
CREATE TABLE "File" (
    "id" UUID NOT NULL,
    "requestItemId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "originalExt" TEXT NOT NULL,
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "File_storageKey_key" ON "File"("storageKey");

-- CreateIndex
CREATE INDEX "File_requestItemId_idx" ON "File"("requestItemId");

-- CreateIndex
CREATE INDEX "File_requestId_idx" ON "File"("requestId");

-- CreateIndex
CREATE INDEX "File_workspaceId_idx" ON "File"("workspaceId");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "RequestItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
