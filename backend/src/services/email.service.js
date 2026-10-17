import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.sentEmails = []; // For testing / auditing inspection in development & automated test suites
    this.initTransporter();
  }

  initTransporter() {
    const user = config.smtpUser || process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = config.smtpPass || process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const host = config.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(config.smtpPort || process.env.SMTP_PORT) || 587;
    const secure = config.smtpSecure || process.env.SMTP_SECURE === 'true';

    if (!user || !pass) {
      this.isConfigured = false;
      return;
    }

    try {
      if (host === 'smtp.gmail.com') {
        // Preferred dedicated Gmail transport
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: user.trim(),
            pass: pass.replace(/\s+/g, ''),
          },
        });
      } else {
        // Generic SMTP transport
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user: user.trim(),
            pass: pass.replace(/\s+/g, ''),
          },
        });
      }
      this.isConfigured = true;
    } catch (err) {
      console.error('[AccountLedger.com API] Failed to initialize Nodemailer transporter:', err.message);
      this.isConfigured = false;
    }
  }

  async verifyConnection() {
    if (!this.isConfigured || !this.transporter) {
      return { success: false, error: 'Email service is not configured with user and app password.' };
    }
    try {
      await this.transporter.verify();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async sendMail({ to, subject, html, text }) {
    const senderEmail = config.smtpUser || process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@accountledger.com';
    const senderName = config.appName || 'AccountLedger';
    const fromAddress = `"${senderName}" <${senderEmail}>`;

    // Record in local test audit log
    const emailRecord = {
      to,
      subject,
      text,
      html,
      from: fromAddress,
      timestamp: new Date().toISOString(),
    };
    this.sentEmails.push(emailRecord);

    if (!this.isConfigured || !this.transporter) {
      // In development or when credentials are not yet entered, simulate delivery without crashing
      return { success: true, simulated: true, messageId: `sim_${Date.now()}` };
    }

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text,
        html,
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[AccountLedger.com API Error] Failed to send email to ${to}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async sendPasswordResetEmail({ to, resetUrl, userDisplayName, expirationMinutes = 20 }) {
    const name = userDisplayName || 'Valued User';
    const appName = config.appName || 'AccountLedger';
    const subject = `Password Reset Request — ${appName}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0d0f12; color: #f3f4f6; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0;">${appName}</h1>
          <p style="color: #9ca3af; font-size: 13px; margin-top: 4px;">Smart Financial Management</p>
        </div>
        <div style="background-color: #14171d; border: 1px solid #22252c; padding: 24px; border-radius: 6px;">
          <h2 style="color: #f3f4f6; font-size: 16px; margin-top: 0;">Hello ${name},</h2>
          <p style="color: #d1d5db; font-size: 14px; line-height: 1.5;">We received a request to reset your password for your ${appName} account.</p>
          <div style="margin: 28px 0; text-align: center;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 4px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">This link will expire in <strong>${expirationMinutes} minutes</strong>. If you did not request a password reset, you can safely ignore this email; your account remains secure.</p>
          <div style="border-top: 1px solid #22252c; margin-top: 20px; padding-top: 16px;">
            <p style="color: #6b7280; font-size: 11px; word-break: break-all; margin: 0;">If the button above does not work, copy and paste this link into your browser:<br/><a href="${resetUrl}" style="color: #3b82f6;">${resetUrl}</a></p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 11px;">
          &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
        </div>
      </div>
    `;

    const text = `Hello ${name},\n\nWe received a request to reset your password for your ${appName} account. Click the link below to reset your password (valid for ${expirationMinutes} minutes):\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.\n\n${appName}`;

    return this.sendMail({ to, subject, html, text });
  }

  async sendWelcomeEmail({ to, userDisplayName }) {
    const name = userDisplayName || 'Valued User';
    const appName = config.appName || 'AccountLedger';
    const subject = `Welcome to ${appName}!`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0d0f12; color: #f3f4f6; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0;">${appName}</h1>
          <p style="color: #9ca3af; font-size: 13px; margin-top: 4px;">Smart Financial Management</p>
        </div>
        <div style="background-color: #14171d; border: 1px solid #22252c; padding: 24px; border-radius: 6px;">
          <h2 style="color: #f3f4f6; font-size: 16px; margin-top: 0;">Welcome, ${name}!</h2>
          <p style="color: #d1d5db; font-size: 14px; line-height: 1.5;">Your ${appName} account has been created successfully. You can now manage your income, expenses, accounts, and financial reports with ease.</p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${config.frontendUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 4px; display: inline-block;">Go to Dashboard</a>
          </div>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 11px;">
          &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
        </div>
      </div>
    `;
    const text = `Welcome, ${name}!\n\nYour ${appName} account has been created successfully.\n\nVisit: ${config.frontendUrl}\n\n${appName}`;
    return this.sendMail({ to, subject, html, text });
  }
}

export const emailService = new EmailService();
