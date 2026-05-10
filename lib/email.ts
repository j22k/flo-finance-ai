import { Resend } from 'resend';

let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set. Add it to your .env.local file.');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

export async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  try {
    const client = getResendClient();
    const data = await client.emails.send({
      from: 'Flo Finance <onboarding@resend.dev>', // You can change this once you have a verified domain
      to,
      subject,
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error };
  }
}
