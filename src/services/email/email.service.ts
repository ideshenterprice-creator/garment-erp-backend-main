import { Resend } from "resend";
import logger from "@/config/logger";
import { frontendUrl, isProduction } from "@/config/env";
import { AppError } from "@/middleware/errorHandler";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function fromAddress(): string {
  return process.env.RESEND_FROM ?? "FabricFlow ERP <noreply@fabricflow.local>";
}

export async function sendInviteEmail(to: string, inviteLink: string): Promise<void> {
  const subject = "You are invited to FabricFlow ERP";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2>FabricFlow ERP invitation</h2>
      <p>You have been invited to join FabricFlow ERP.</p>
      <p>This link expires after the configured invitation window and can be used only once.</p>
      <p><a href="${inviteLink}" style="background:#1b3a3a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Accept invitation</a></p>
      <p>If the button does not work, copy this URL:</p>
      <p>${inviteLink}</p>
    </div>
  `;

  const client = getResend();
  if (!client) {
    if (isProduction()) {
      throw new AppError(
        "Email delivery is not configured. Set RESEND_API_KEY.",
        503,
        "EMAIL_NOT_CONFIGURED"
      );
    }
    logger.info("Invite email skipped (RESEND_API_KEY not set)", {
      to,
      frontend: frontendUrl(),
    });
    return;
  }

  const { error } = await client.emails.send({
    from: fromAddress(),
    to,
    subject,
    html,
  });

  if (error) {
    logger.error("Failed to send invite email", { to, name: error.name });
    throw new AppError("Failed to send invitation email", 502, "EMAIL_DELIVERY_FAILED");
  }

  logger.info("Invite email sent", { to });
}
