import { Resend } from 'resend';
import config from '../config/config';

const resend = new Resend(config.resend.apiKey);

export const sendContactConfirmation = async (data: {
  email: string;
  reason: string;
}) => {
  const year = new Date().getFullYear();

  await resend.emails.send({
    from: config.resend.fromEmail,
    to: data.email,
    subject: `We received your message — Youth Contest`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Message Received</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);padding:40px 48px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:1px;">Youth Contest</h1>
              <p style="margin:8px 0 0;color:#a0b4cc;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Message Received</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px;">
              <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:22px;font-weight:600;">Thanks for reaching out! ✉️</h2>
              <p style="margin:0 0 28px;color:#4a5568;font-size:15px;line-height:1.8;">
                We've received your message regarding <strong>${data.reason}</strong> and our team will review it shortly.
              </p>

              <!-- 48hr highlight box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#e9f0fb,#dbeafe);border-radius:10px;padding:28px 32px;text-align:center;">
                    <p style="margin:0 0 8px;color:#0f3460;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;">Expected Response Time</p>
                    <p style="margin:0;color:#1a1a2e;font-size:42px;font-weight:800;letter-spacing:2px;">48 hrs</p>
                    <p style="margin:8px 0 0;color:#4a6fa5;font-size:13px;">A member of our team will get back to you within 48 hours.</p>
                  </td>
                </tr>
              </table>

              <!-- What happens next -->
              <h3 style="margin:0 0 16px;color:#1a1a2e;font-size:15px;font-weight:600;">What happens next?</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                <tr><td style="padding:8px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;height:28px;background:#0f3460;border-radius:50%;text-align:center;vertical-align:middle;">
                      <span style="color:#fff;font-size:13px;font-weight:700;">1</span>
                    </td>
                    <td style="padding-left:12px;color:#4a5568;font-size:14px;line-height:1.6;">Our team reviews your message and assigns it to the right person.</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:8px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;height:28px;background:#0f3460;border-radius:50%;text-align:center;vertical-align:middle;">
                      <span style="color:#fff;font-size:13px;font-weight:700;">2</span>
                    </td>
                    <td style="padding-left:12px;color:#4a5568;font-size:14px;line-height:1.6;">You'll receive a reply directly to <strong>${data.email}</strong> within 48 hours.</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:8px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;height:28px;background:#0f3460;border-radius:50%;text-align:center;vertical-align:middle;">
                      <span style="color:#fff;font-size:13px;font-weight:700;">3</span>
                    </td>
                    <td style="padding-left:12px;color:#4a5568;font-size:14px;line-height:1.6;">If it's urgent, feel free to follow up by replying to this email.</td>
                  </tr></table>
                </td></tr>
              </table>

              <!-- Notice -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#fff8f0;border-left:4px solid #ed8936;border-radius:0 6px 6px 0;padding:16px 20px;">
                    <p style="margin:0;color:#7b341e;font-size:13px;line-height:1.6;">
                      <strong>⚠ Please do not submit duplicate requests.</strong> Your message has been logged and will be handled in the order it was received.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:28px 48px;text-align:center;">
              <p style="margin:0 0 6px;color:#a0aec0;font-size:12px;">This is an automated confirmation — please do not reply to this email.</p>
              <p style="margin:0;color:#a0aec0;font-size:12px;">&copy; ${year} Youth Contest. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
};

export const sendContactNotification = async (data: {
  email: string;
  phone: string;
  reason: string;
  message: string;
}) => {
  const year = new Date().getFullYear();

  await resend.emails.send({
    from: config.resend.fromEmail,
    to: config.resend.fromEmail,
    replyTo: data.email,
    subject: `[Contact] ${data.reason} — from ${data.email}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Contact Message</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);padding:40px 48px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:1px;">Youth Contest</h1>
              <p style="margin:8px 0 0;color:#a0b4cc;font-size:13px;letter-spacing:2px;text-transform:uppercase;">New Contact Message</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px;">
              <h2 style="margin:0 0 24px;color:#1a1a2e;font-size:20px;font-weight:600;">Someone reached out 📬</h2>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Email</p>
                    <p style="margin:0 0 20px;color:#1a1a2e;font-size:15px;">${data.email}</p>

                    <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Phone</p>
                    <p style="margin:0 0 20px;color:#1a1a2e;font-size:15px;">${data.phone}</p>

                    <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Reason</p>
                    <p style="margin:0 0 20px;">
                      <span style="display:inline-block;background:#e9f0fb;color:#0f3460;font-size:13px;font-weight:600;padding:4px 12px;border-radius:20px;">${data.reason}</span>
                    </p>

                    <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Message</p>
                    <p style="margin:0;color:#2d3748;font-size:15px;line-height:1.7;white-space:pre-wrap;">${data.message}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f0fff4;border-left:4px solid #38a169;border-radius:0 6px 6px 0;padding:14px 18px;">
                    <p style="margin:0;color:#276749;font-size:13px;line-height:1.6;">
                      💡 You can reply directly to this email to respond to <strong>${data.email}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 48px;text-align:center;">
              <p style="margin:0;color:#a0aec0;font-size:12px;">&copy; ${year} Youth Contest. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
};

export const sendStaffInviteEmail = async (email: string, pinCode: string) => {
  const dashboardUrl = config.staff.dashboardUrl;
  const year = new Date().getFullYear();

  await resend.emails.send({
    from: config.resend.fromEmail,
    to: email,
    subject: 'Welcome to Youth Contest – Your Staff Account is Ready',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Staff Account Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);padding:40px 48px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:1px;">Youth Contest</h1>
              <p style="margin:8px 0 0;color:#a0b4cc;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Staff Portal</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:22px;font-weight:600;">Welcome aboard! 👋</h2>
              <p style="margin:0 0 24px;color:#4a5568;font-size:15px;line-height:1.7;">
                A staff account has been created for you on the <strong>Youth Contest Management Platform</strong>.
                You can now access the system using the credentials below.
              </p>

              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:32px;">
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Login Email</p>
                    <p style="margin:0 0 24px;color:#1a1a2e;font-size:16px;font-weight:600;">${email}</p>

                    <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">One-Time PIN Code</p>
                    <p style="margin:0;font-size:16px;">
                      <code style="background:#edf2f7;color:#2d3748;padding:6px 14px;border-radius:5px;font-size:15px;letter-spacing:3px;font-weight:700;">${pinCode}</code>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <h3 style="margin:0 0 14px;color:#1a1a2e;font-size:15px;font-weight:600;">Getting started in 3 steps:</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                <tr>
                  <td style="padding:8px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:28px;height:28px;background:#0f3460;border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="color:#fff;font-size:13px;font-weight:700;">1</span>
                        </td>
                        <td style="padding-left:12px;color:#4a5568;font-size:14px;line-height:1.6;">Click the button below to go to the activation page.</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:28px;height:28px;background:#0f3460;border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="color:#fff;font-size:13px;font-weight:700;">2</span>
                        </td>
                        <td style="padding-left:12px;color:#4a5568;font-size:14px;line-height:1.6;">Enter your email, the PIN code above, and choose a new password.</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:28px;height:28px;background:#0f3460;border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="color:#fff;font-size:13px;font-weight:700;">3</span>
                        </td>
                        <td style="padding-left:12px;color:#4a5568;font-size:14px;line-height:1.6;">Your account activates instantly — log in with your new password from then on.</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl?.replace('/staff/login', '/activate') ?? '#'}"
                      style="display:inline-block;background:linear-gradient(135deg,#0f3460,#16213e);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:7px;letter-spacing:0.5px;">
                      Activate My Account &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
                <tr>
                  <td style="background:#fff8f0;border-left:4px solid #ed8936;border-radius:0 6px 6px 0;padding:16px 20px;">
                    <p style="margin:0;color:#7b341e;font-size:13px;line-height:1.6;">
                      <strong>⚠ Security Notice:</strong> These credentials are for your use only. Do not share them with anyone.
                      The PIN code is single-use and will be invalidated after your first login.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:28px 48px;text-align:center;">
              <p style="margin:0 0 6px;color:#a0aec0;font-size:12px;">This is an automated message — please do not reply to this email.</p>
              <p style="margin:0;color:#a0aec0;font-size:12px;">&copy; ${year} Youth Contest. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
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
  const year = new Date().getFullYear();
  const expiryStr = data.expiresAt.toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  await resend.emails.send({
    from: config.resend.fromEmail,
    to: data.email,
    subject: `Your School Report Access — ${data.tournamentName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>School Report Access</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);padding:40px 48px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:1px;">Youth Contest</h1>
              <p style="margin:8px 0 0;color:#a0b4cc;font-size:13px;letter-spacing:2px;text-transform:uppercase;">School Report Access</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px;">
              <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:22px;font-weight:600;">Your access is ready 🎓</h2>
              <p style="margin:0 0 8px;color:#4a5568;font-size:15px;line-height:1.7;">
                You have been granted access to view the performance report for <strong>${data.schoolName}</strong> in <strong>${data.tournamentName}</strong>.
              </p>
              <p style="margin:0 0 32px;color:#4a5568;font-size:15px;line-height:1.7;">
                Use the credentials below to log in and view your school's results.
              </p>

              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:32px;">
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Login Email</p>
                    <p style="margin:0 0 24px;color:#1a1a2e;font-size:16px;font-weight:600;">${data.email}</p>

                    <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Access Code</p>
                    <p style="margin:0 0 24px;">
                      <code style="background:#edf2f7;color:#2d3748;padding:8px 18px;border-radius:5px;font-size:22px;letter-spacing:6px;font-weight:800;">${data.accessCode}</code>
                    </p>

                    <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Access Expires</p>
                    <p style="margin:0;color:#e53e3e;font-size:14px;font-weight:600;">${expiryStr}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${data.loginUrl}"
                      style="display:inline-block;background:linear-gradient(135deg,#0f3460,#16213e);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:7px;letter-spacing:0.5px;">
                      View My School Report &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#fff8f0;border-left:4px solid #ed8936;border-radius:0 6px 6px 0;padding:16px 20px;">
                    <p style="margin:0;color:#7b341e;font-size:13px;line-height:1.6;">
                      <strong>⚠ Important:</strong> This access link and code expire on <strong>${expiryStr}</strong>. Do not share your credentials with others.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:28px 48px;text-align:center;">
              <p style="margin:0 0 6px;color:#a0aec0;font-size:12px;">This is an automated message — please do not reply to this email.</p>
              <p style="margin:0;color:#a0aec0;font-size:12px;">&copy; ${year} Youth Contest. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
};
