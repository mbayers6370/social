-- New accounts start with like notifications off; existing choices are preserved.
ALTER TABLE "Account" ALTER COLUMN "notifyLikes" SET DEFAULT false;
