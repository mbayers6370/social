-- Portrait framing belongs to the account; the original photograph is unchanged.
ALTER TABLE "Account" ADD COLUMN "portraitCrop" JSONB NOT NULL DEFAULT '{"x":0.5,"y":0.5,"zoom":1}';
