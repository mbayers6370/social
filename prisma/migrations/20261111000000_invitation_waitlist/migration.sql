CREATE TABLE "WaitlistEntry" (
  "email" VARCHAR(254) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consentVersion" VARCHAR(40) NOT NULL,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("email"),
  CONSTRAINT "WaitlistEntry_email_canonical" CHECK (
    "email" = lower(btrim("email")) AND char_length("email") BETWEEN 3 AND 254
  ),
  CONSTRAINT "WaitlistEntry_consent" CHECK ("consentVersion" = 'invitation-news-v1')
);
