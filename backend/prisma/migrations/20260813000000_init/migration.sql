CREATE TABLE "Scene" (
    "roomId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("roomId")
);

CREATE TABLE "SceneFile" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "gcsPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneFile_pkey" PRIMARY KEY ("roomId", "id")
);

CREATE INDEX "SceneFile_roomId_idx" ON "SceneFile"("roomId");
