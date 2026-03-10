const axios = require('axios');
const logger = require('../utils/logger');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

function getBrevoConfig() {
    const apiKey = (process.env.BREVO_API_KEY || '').trim();
    const fromEmail = (process.env.EMAIL_FROM || 'no-reply@yourdomain.com').trim();
    const fromName = (process.env.EMAIL_FROM_NAME || 'Your Store').trim();
    if (!apiKey) throw new Error('BREVO_API_KEY is not configured');
    if (apiKey.startsWith('xsmtpsib-')) {
        throw new Error('BREVO_API_KEY looks like an SMTP key. Use API key from Brevo Settings → SMTP & API → API Keys (xkeysib-).');
    }
    return { apiKey, fromEmail, fromName };
}

function buildOtpEmailHtml(otp, options = {}) {
    const storeName = (process.env.EMAIL_FROM_NAME || 'Apnamart').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const title = options.title || 'Verification code';
    const validity = options.validity || '10 minutes';
    const subtitle = options.subtitle || 'Use this code to complete your verification.';
    const otpSafe = String(otp || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} – ${storeName}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;">
    <tr>
      <td style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 24px;background:linear-gradient(135deg,#1f2937 0%,#374151 100%);text-align:center;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${storeName}</p>
              <p style="margin:8px 0 0 0;font-size:13px;color:#9ca3af;">${title}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#6b7280;">${subtitle}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0;background:#f0f9ff;border:2px dashed #0ea5e9;border-radius:12px;">
                <tr>
                  <td style="padding:24px;text-align:center;">
                    <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#0369a1;">Your code</p>
                    <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:0.25em;font-family:ui-monospace,monospace;color:#0c4a6e;">${otpSafe}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#6b7280;">Valid for ${validity}. Do not share this code with anyone.</p>
              <p style="margin:16px 0 0 0;font-size:13px;color:#9ca3af;">If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

function buildCodOtpEmailHtml(otp) {
    return buildOtpEmailHtml(otp, {
        title: 'COD order verification',
        validity: '5 minutes',
        subtitle: 'Use this one-time password to confirm your Cash on Delivery order.',
    });
}

/**
 * Send HTML email via Brevo. Throws on failure.
 */
async function sendHtmlEmail({ to, subject, htmlContent }) {
    const { apiKey, fromEmail, fromName } = getBrevoConfig();
    const res = await axios.post(
        BREVO_URL,
        {
            sender: { name: fromName, email: fromEmail },
            to: Array.isArray(to) ? to.map(e => (typeof e === 'string' ? { email: e } : e)) : [{ email: to }],
            subject,
            htmlContent,
        },
        {
            headers: {
                accept: 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json',
            },
        }
    );
    if (res.data?.messageId) {
        logger.info(`Brevo email sent messageId=${res.data.messageId} to=${to}`);
    }
    return res.data;
}

/**
 * Send OTP email via Brevo (Transactional).
 */
async function sendOtpEmail({ to, otp, subject = 'Your Verification Code' }) {
    const htmlContent = buildOtpEmailHtml(otp);
    return sendHtmlEmail({ to, subject, htmlContent });
}

/**
 * Send COD (Cash on Delivery) OTP email.
 */
async function sendCodOtpEmail({ to, otp }) {
    const subject = 'Verify Your COD Order - OTP';
    const htmlContent = buildCodOtpEmailHtml(otp);
    return sendHtmlEmail({ to, subject, htmlContent });
}

module.exports = { sendHtmlEmail, sendOtpEmail, sendCodOtpEmail, getBrevoConfig };
