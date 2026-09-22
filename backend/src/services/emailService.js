import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter = null;

// Initialize Nodemailer transporter
function getTransporter() {
  if (transporter) return transporter;

  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_SECURE } = process.env;

  const isPlaceholderPassword = !EMAIL_PASSWORD || EMAIL_PASSWORD.includes('YOUR_NEW_APP_PASSWORD');
  if (EMAIL_HOST && EMAIL_USER && !isPlaceholderPassword) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: Number(EMAIL_PORT) || 587,
      secure: EMAIL_SECURE === 'true',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD
      }
    });
    console.log(`[EmailService] Configured live SMTP transport: ${EMAIL_HOST}:${EMAIL_PORT || 587}`);
  } else {
    if (isPlaceholderPassword && EMAIL_USER) {
      console.log(`[EmailService] Gmail SMTP user configured (${EMAIL_USER}), but waiting for Google App Password in backend/.env. Using development mail logger.`);
    } else {
      console.log('[EmailService] SMTP credentials not set in .env. Using development mail logger.');
    }
    // Development fallback transport: logs cleanly to console & memory
    transporter = {
      isDevFallback: true,
      async sendMail(mailOptions) {
        console.log('====================================================');
        console.log('📨 [EmailService - Outgoing Message Dispatched]');
        console.log(`To: ${mailOptions.to}`);
        console.log(`From: ${mailOptions.from || process.env.EMAIL_FROM}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`Body:\n${mailOptions.text || mailOptions.html}`);
        console.log('====================================================');
        return { messageId: `dev-msg-${Date.now()}`, response: '250 Dispatched via local dev transport' };
      }
    };
    console.log('[EmailService] SMTP credentials not set in .env. Using development mail logger.');
  }

  return transporter;
}

export const emailService = {
  async sendEnquiryNotification({ enquiry }) {
    const transport = getTransporter();
    const from = process.env.EMAIL_FROM || '"Jharkhand Tourism" <no-reply@jharkhandtourism.gov.in>';
    const to = process.env.ENQUIRY_NOTIFICATION_EMAIL || 'jharkhandtourism50@gmail.com';
    const subject = `New tourism enquiry from ${enquiry.name}`;
    const text = [
      `New enquiry received from ${enquiry.name} (${enquiry.email})`,
      '',
      enquiry.message,
      '',
      `Enquiry ID: ${enquiry.id}`
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#070b14;color:#f1f5f9"><h2 style="color:#f59e0b">New Tourism Enquiry</h2><p><strong>Name:</strong> ${enquiry.name}</p><p><strong>Email:</strong> ${enquiry.email}</p><p><strong>Message:</strong></p><p style="white-space:pre-wrap">${enquiry.message}</p><p style="color:#94a3b8;font-size:12px">Enquiry ID: ${enquiry.id}</p></div>`;
    return transport.sendMail({ from, to, replyTo: enquiry.email, subject, text, html });
  },

  /**
   * Send single-use cryptographically secure OTP for Registration
   */
  async sendRegistrationOTP({ to, name, otp }) {
    const transport = getTransporter();
    const from = process.env.EMAIL_FROM || '"Jharkhand Tourism" <no-reply@jharkhandtourism.gov.in>';
    const subject = `${otp} is your Jharkhand Tourism Verification Code`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #070b14; color: #f1f5f9; padding: 32px; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #f59e0b; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Jharkhand Smart Tourism</h1>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 4px; letter-spacing: 1px;">SOVEREIGN IDENTITY & SECURE TRAVEL PLATFORM</p>
        </div>
        <div style="background-color: #0b1326; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
          <p style="color: #e2e8f0; font-size: 15px; margin-top: 0;">Johar, <strong>${name}</strong>!</p>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">Thank you for registering on the Jharkhand Smart Tourism Platform. To verify your email address, please enter this one-time verification code:</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <span style="display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #f59e0b; background-color: #1e293b; padding: 14px 28px; border-radius: 12px; border: 1px solid #d97706; font-family: monospace;">
              ${otp}
            </span>
          </div>

          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
            ⚠️ This code is single-use and will expire in <strong>10 minutes</strong>. If you did not request this registration, please disregard this message.
          </p>
        </div>
        <div style="text-align: center; margin-top: 24px; color: #64748b; font-size: 11px;">
          © 2026 Jharkhand Tourism Development Corporation. All rights reserved.
        </div>
      </div>
    `;

    const text = `Johar ${name}!\n\nYour Jharkhand Smart Tourism verification code is: ${otp}\n\nThis code will expire in 10 minutes. Do not share it with anyone.`;

    return await transport.sendMail({ from, to, subject, text, html });
  },

  /**
   * Send Password Reset OTP
   */
  async sendPasswordResetOTP({ to, name, otp }) {
    const transport = getTransporter();
    const from = process.env.EMAIL_FROM || '"Jharkhand Tourism" <no-reply@jharkhandtourism.gov.in>';
    const subject = `${otp} is your Password Reset Code`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #070b14; color: #f1f5f9; padding: 32px; border-radius: 16px; border: 1px solid #1e293b;">
        <h2 style="color: #f59e0b;">Password Reset Request</h2>
        <p>Johar ${name}, we received a request to reset your password. Use the code below:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #f59e0b; background-color: #1e293b; padding: 12px 24px; border-radius: 8px;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 12px; color: #94a3b8;">This code expires in 10 minutes. If you did not request this, your account remains safe.</p>
      </div>
    `;

    return await transport.sendMail({ from, to, subject, text: `Your password reset code: ${otp}`, html });
  },

  async sendLoginOTP({ to, name, otp }) {
    const transport = getTransporter();
    const from = process.env.EMAIL_FROM || '"Jharkhand Tourism" <no-reply@jharkhandtourism.gov.in>';
    const subject = `${otp} is your Jharkhand Tourism sign-in code`;
    const text = `Johar ${name},\n\nYour Jharkhand Tourism sign-in code is ${otp}. It expires in 10 minutes. Do not share it with anyone.`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#070b14;color:#f1f5f9"><h2 style="color:#f59e0b">Secure sign-in code</h2><p>Johar ${name},</p><p>Use this one-time code to sign in to Jharkhand Tourism:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#f59e0b;text-align:center">${otp}</p><p style="font-size:12px;color:#94a3b8">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`;
    return await transport.sendMail({ from, to, subject, text, html });
  },

  /**
   * Send Booking Confirmation & Escrow Notice
   */
  async sendBookingConfirmation({ to, name, booking }) {
    const transport = getTransporter();
    const from = process.env.EMAIL_FROM || '"Jharkhand Tourism" <no-reply@jharkhandtourism.gov.in>';
    const subject = `Booking Confirmed: ${booking.id} - ${booking.item_title}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #070b14; color: #f1f5f9; padding: 32px; border-radius: 16px; border: 1px solid #1e293b;">
        <h2 style="color: #10b981;">Booking Confirmed (Escrow Protected)</h2>
        <p>Johar ${name},</p>
        <p>Your booking <strong>${booking.id}</strong> has been secured. Your funds (₹${booking.total_amount.toLocaleString('en-IN')}) are safely held in decentralized escrow until service completion.</p>
        <ul style="color: #cbd5e1; font-size: 14px; line-height: 1.8;">
          <li><strong>Experience:</strong> ${booking.item_title}</li>
          <li><strong>Date:</strong> ${booking.check_in_date || 'Scheduled'}</li>
          <li><strong>Total Amount:</strong> ₹${booking.total_amount.toLocaleString('en-IN')}</li>
          <li><strong>Escrow Status:</strong> ${booking.escrow_status}</li>
        </ul>
        <p style="font-size: 12px; color: #94a3b8;">You can view and manage your booking directly from your Tourist Dashboard.</p>
      </div>
    `;

    return await transport.sendMail({ from, to, subject, text: `Booking confirmed: ${booking.id}`, html });
  }
};
