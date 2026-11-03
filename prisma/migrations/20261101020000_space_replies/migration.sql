ALTER TABLE "PostComment" ADD COLUMN "replyToId" TEXT;
CREATE UNIQUE INDEX "PostComment_id_postId_key" ON "PostComment"("id", "postId");
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_reply_same_post" FOREIGN KEY ("replyToId", "postId") REFERENCES "PostComment"("id", "postId") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
