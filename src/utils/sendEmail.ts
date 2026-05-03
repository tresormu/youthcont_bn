import nodemailer from 'nodemailer';
import config from '../config/config';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
});

type EmailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

const BRAND_NAME = 'THEYOUTHCONTEST';
const BRAND_PRIMARY = '#0f4cbd';
const BRAND_DARK = '#0b2f73';
const BRAND_SOFT = '#edf4ff';
const logoUrl = config.clientUrl ? `${config.clientUrl.replace(/\/$/, '')}/LOGO.jpeg` : '';

const renderLayout = ({
  title,
  subtitle,
  body,
  footerNote,
}: {
  title: string;
  subtitle: string;
  body: string;
  footerNote?: string;
}) => {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f8ff;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;background:#f5f8ff;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe7ff;">
          <tr>
            <td style="padding:28px 30px;background:linear-gradient(135deg, ${BRAND_DARK} 0%, ${BRAND_PRIMARY} 100%);text-align:center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${BRAND_NAME}" width="56" height="56" style="display:block;margin:0 auto 10px;border-radius:12px;object-fit:cover;border:2px solid rgba(255,255,255,0.25);" />` : ''}
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.4px;">${BRAND_NAME}</h1>
              <p style="margin:8px 0 0;color:#cfe0ff;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;">${subtitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 30px;border-top:1px solid #e5edff;background:#f8fbff;text-align:center;">
              ${footerNote ? `<p style="margin:0 0 6px;color:#64748b;font-size:12px;">${footerNote}</p>` : ''}
              <p style="margin:0;color:#94a3b8;font-size:12px;">&copy; ${year} ${BRAND_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

const sendEmail = async (payload: EmailPayload) => {
  await transporter.sendMail(payload);
};

export const sendContactConfirmation = async (data: {
  email: string;
  reason: string;
}) => {
  const body = `
    <h2 style="margin:0 0 10px;color:${BRAND_DARK};font-size:24px;">Message Received</h2>
    <p style="margin:0 0 16px;line-height:1.7;color:#334155;">
      Thank you for contacting us. We received your message about
      <strong>${data.reason}</strong>.
    </p>
    <div style="background:${BRAND_SOFT};border:1px solid #cfe0ff;border-radius:10px;padding:18px;margin:0 0 18px;text-align:center;">
      <p style="margin:0 0 6px;color:#475569;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Expected Response Time</p>
      <p style="margin:0;color:${BRAND_PRIMARY};font-size:30px;font-weight:800;">Within 48 Hours</p>
    </div>
    <p style="margin:0;line-height:1.7;color:#334155;">
      We will reply directly to <strong>${data.email}</strong>. Please avoid duplicate submissions so we can respond faster.
    </p>
  `;

  await sendEmail({
    from: `"${BRAND_NAME}" <${config.smtp.from}>`,
    to: data.email,
    subject: `We received your message - ${BRAND_NAME}`,
    html: renderLayout({
      title: 'Message Received',
      subtitle: 'Contact Confirmation',
      body,
      footerNote: 'This is an automated confirmation email.',
    }),
  });
};

export const sendContactNotification = async (data: {
  email: string;
  phone: string;
  reason: string;
  message: string;
}) => {
  const body = `
    <h2 style="margin:0 0 14px;color:${BRAND_DARK};font-size:24px;">New Contact Message</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe7ff;border-radius:10px;overflow:hidden;margin:0 0 14px;">
      <tr><td style="background:${BRAND_SOFT};padding:10px 14px;font-size:12px;color:#475569;font-weight:700;text-transform:uppercase;">Email</td></tr>
      <tr><td style="padding:12px 14px;font-size:14px;color:#0f172a;">${data.email}</td></tr>
      <tr><td style="background:${BRAND_SOFT};padding:10px 14px;font-size:12px;color:#475569;font-weight:700;text-transform:uppercase;">Phone</td></tr>
      <tr><td style="padding:12px 14px;font-size:14px;color:#0f172a;">${data.phone}</td></tr>
      <tr><td style="background:${BRAND_SOFT};padding:10px 14px;font-size:12px;color:#475569;font-weight:700;text-transform:uppercase;">Reason</td></tr>
      <tr><td style="padding:12px 14px;font-size:14px;color:#0f172a;">${data.reason}</td></tr>
      <tr><td style="background:${BRAND_SOFT};padding:10px 14px;font-size:12px;color:#475569;font-weight:700;text-transform:uppercase;">Message</td></tr>
      <tr><td style="padding:12px 14px;font-size:14px;line-height:1.7;color:#0f172a;white-space:pre-wrap;">${data.message}</td></tr>
    </table>
    <p style="margin:0;color:#334155;line-height:1.6;">You can reply directly to this email to respond to the sender.</p>
  `;

  await sendEmail({
    from: `"${BRAND_NAME}" <${config.smtp.from}>`,
    to: config.smtp.from,
    replyTo: data.email,
    subject: `[Contact] ${data.reason} - from ${data.email}`,
    html: renderLayout({
      title: 'New Contact Message',
      subtitle: 'Inbox Notification',
      body,
    }),
  });
};

export const sendStaffInviteEmail = async (email: string, pinCode: string) => {
  const dashboardUrl = config.staff.dashboardUrl;
  const activateUrl = dashboardUrl?.replace('/staff/login', '/activate') ?? '#';

  const body = `
    <h2 style="margin:0 0 10px;color:${BRAND_DARK};font-size:24px;">Staff Account Invitation</h2>
    <p style="margin:0 0 16px;line-height:1.7;color:#334155;">A staff account has been created for you.</p>
    <div style="background:${BRAND_SOFT};border:1px solid #cfe0ff;border-radius:10px;padding:16px;margin-bottom:18px;">
      <p style="margin:0 0 8px;color:#475569;font-size:12px;font-weight:700;text-transform:uppercase;">Login Email</p>
      <p style="margin:0 0 14px;color:#0f172a;font-size:15px;"><strong>${email}</strong></p>
      <p style="margin:0 0 8px;color:#475569;font-size:12px;font-weight:700;text-transform:uppercase;">One-Time PIN</p>
      <p style="margin:0;"><span style="display:inline-block;padding:8px 12px;background:#ffffff;border:1px dashed #94a3b8;border-radius:8px;letter-spacing:3px;font-weight:800;color:${BRAND_DARK};">${pinCode}</span></p>
    </div>
    <ol style="margin:0 0 18px 18px;padding:0;color:#334155;line-height:1.8;">
      <li>Open the activation page.</li>
      <li>Enter your email, PIN, and set your password.</li>
      <li>Sign in to your staff dashboard.</li>
    </ol>
    <p style="margin:0 0 18px;text-align:center;">
      <a href="${activateUrl}" style="display:inline-block;background:${BRAND_PRIMARY};color:#fff;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:700;">Activate Account</a>
    </p>
    <p style="margin:0;color:#475569;font-size:13px;">Keep this PIN private. It is single-use.</p>
  `;

  await sendEmail({
    from: `"${BRAND_NAME}" <${config.smtp.from}>`,
    to: email,
    subject: `Welcome to ${BRAND_NAME} - Staff Account Invitation`,
    html: renderLayout({
      title: 'Staff Account Invitation',
      subtitle: 'Staff Portal Access',
      body,
      footerNote: 'This is an automated invitation email.',
    }),
  });
};

export const sendSchoolOwnerAccessEmail = async (data: {
  email: string;
  schoolName: string;
  tournamentName: string;
  accessCode: string;
  expiresAt: Date;
  loginUrl: string;
}) => {
  const expiryStr = data.expiresAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  const body = `
    <h2 style="margin:0 0 10px;color:${BRAND_DARK};font-size:24px;">School Report Access</h2>
    <p style="margin:0 0 16px;line-height:1.7;color:#334155;">
      You can now access <strong>${data.schoolName}</strong> results for <strong>${data.tournamentName}</strong>.
    </p>
    <div style="background:${BRAND_SOFT};border:1px solid #cfe0ff;border-radius:10px;padding:16px;margin:0 0 18px;">
      <p style="margin:0 0 8px;color:#475569;font-size:12px;font-weight:700;text-transform:uppercase;">Login Email</p>
      <p style="margin:0 0 14px;color:#0f172a;font-size:15px;"><strong>${data.email}</strong></p>
      <p style="margin:0 0 8px;color:#475569;font-size:12px;font-weight:700;text-transform:uppercase;">Access Code</p>
      <p style="margin:0 0 14px;"><span style="display:inline-block;padding:8px 12px;background:#ffffff;border:1px dashed #94a3b8;border-radius:8px;letter-spacing:3px;font-weight:800;color:${BRAND_DARK};">${data.accessCode}</span></p>
      <p style="margin:0;color:#b91c1c;font-size:13px;"><strong>Expires:</strong> ${expiryStr}</p>
    </div>
    <p style="margin:0 0 18px;text-align:center;">
      <a href="${data.loginUrl}" style="display:inline-block;background:${BRAND_PRIMARY};color:#fff;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:700;">View School Report</a>
    </p>
    <p style="margin:0;color:#475569;font-size:13px;">Do not share this access code. It is time-limited.</p>
  `;

  await sendEmail({
    from: `"${BRAND_NAME}" <${config.smtp.from}>`,
    to: data.email,
    subject: `Your School Report Access - ${data.tournamentName}`,
    html: renderLayout({
      title: 'School Report Access',
      subtitle: 'Secure Report Login',
      body,
      footerNote: 'This is an automated message.',
    }),
  });
};
