import nodemailer from 'nodemailer';
import { config } from '../config.js';

// Create a transporter using SMTP or local testing (Ethereal)
// In development, we can log the email content or use a test service
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'ethereal.user',
    pass: process.env.SMTP_PASS || 'ethereal.pass',
  },
});

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${config.CORS_ORIGINS.split(',')[0]}/reset-password?token=${token}`;

  const mailOptions = {
    from: '"Grow Fortress" <noreply@grow-fortress.com>',
    to: email,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Please use the following link to reset your password: ${resetUrl}\n\nThis link will expire in 1 hour.`,
    html: `
      <h1>Password Reset Request</h1>
      <p>You requested a password reset for your Grow Fortress account.</p>
      <p>Please click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  };

  if (config.NODE_ENV === 'development') {
    console.log('---------------------------------------');
    console.log('EMAIL SENT (Development Mode)');
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('---------------------------------------');
    return;
  }

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    // Don't throw here to avoid leaking account existence, 
    // but in a real app you might want to handle this better
  }
}
