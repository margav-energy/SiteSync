import { sendMail } from './mail';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function sendInvitationCodeEmail(params: {
  email: string;
  token: string;
  role: string;
  expiresAt: Date;
}): Promise<boolean> {
  const email = params.email.trim().toLowerCase();
  const code = params.token.trim().toUpperCase();
  const formattedCode = code.replace(/(.{4})/g, '$1-').replace(/-$/, '');
  const role = params.role.trim().toLowerCase();
  const expires = params.expiresAt.toLocaleString();
  const subject = 'Your SiteSync invitation code';
  const text =
    `You have been invited to SiteSync as ${role}.\n\n` +
    `Invitation code: ${formattedCode}\n` +
    `Expires: ${expires}\n\n` +
    'Use this code in the app under "Complete invitation" to finish sign up.';
  const html = `
    <div style="margin:0;padding:24px;background:#f4f3f8;font-family:Segoe UI,Arial,sans-serif;color:#1f1f1f;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #ece7f6;">
        <div style="background:#4a026f;padding:18px 24px;">
          <div style="font-size:22px;font-weight:700;color:#ffffff;">SiteSync</div>
          <div style="font-size:13px;color:#eadcf5;margin-top:4px;">Invitation code</div>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;">You have been invited to SiteSync as <strong>${escapeHtml(role)}</strong>.</p>
          <p style="margin:0 0 10px 0;font-size:14px;color:#555;">Use this code to complete your sign up:</p>
          <div style="margin:0 0 16px 0;padding:14px 16px;border:1px dashed #b999d4;border-radius:10px;background:#faf7fd;font-size:28px;font-weight:700;letter-spacing:2px;color:#2f0448;text-align:center;font-family:Consolas,Menlo,Monaco,monospace;">
            ${escapeHtml(formattedCode)}
          </div>
          <p style="margin:0 0 8px 0;font-size:14px;"><strong>Expires:</strong> ${escapeHtml(expires)}</p>
          <p style="margin:0;font-size:14px;line-height:1.5;color:#444;">Open the app and go to <strong>Complete invitation</strong> to continue.</p>
        </div>
      </div>
    </div>
  `;
  return sendMail({ to: email, subject, text, html });
}
