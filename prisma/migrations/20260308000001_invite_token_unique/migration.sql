-- Add unique constraint to prevent duplicate invites for the same account+email pair.
-- The invite_tokens table was created in the previous migration (20260308000000_email_invites_multitenant).
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_account_id_email_key" UNIQUE ("account_id", "email");
