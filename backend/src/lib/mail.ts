import nodemailer from 'nodemailer';

function env(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function envBool(name: string): boolean | undefined {
  const value = env(name);
  if (!value) return undefined;
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
  return undefined;
}

function envPort(name: string, fallback: number): number {
  const raw = env(name);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function mailFromAddress(): string {
  return env('EMAIL_FROM') ?? 'developer@sitesync.uk';
}

function smtpEnabled(): boolean {
  return Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS'));
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!smtpEnabled()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port: envPort('SMTP_PORT', 587),
    secure: envBool('SMTP_SECURE') ?? false,
    auth: {
      user: env('SMTP_USER'),
      pass: env('SMTP_PASS'),
    },
  });
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; text: string; html: string }): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn('[mail] SMTP not configured - skipping email send');
    return false;
  }
  await t.sendMail({
    from: mailFromAddress(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return true;
}
