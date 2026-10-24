import { Store } from '../store';
import { TerminalLogger } from './terminalLogger';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE || 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const TARGET_EMAIL = process.env.CFO_EMAIL || 'sanskarmain16@gmail.com';
const OTP_EXPIRY_MS = 30_000; // 30 seconds
const MAX_OTP_ATTEMPTS = 3;

export const verificationService = {
  generateOTP(): string {
    // crypto.randomInt would be better, but Math.random is fine for demo
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  async sendOtpEmail(otp: string): Promise<void> {
    try {
      await transporter.sendMail({
        from: `"Aegis Security Gateway" <${process.env.SMTP_USER}>`,
        to: TARGET_EMAIL,
        subject: '🚨 Aegis Mission Verification Code (OTP)',
        text: `Aegis Security Alert: Your verification code for the pending transaction is ${otp}. Do not share this code.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #0b0b0b; color: #ffffff; border-radius: 8px;">
            <h2 style="color: #d4af37;">AEGIS Sovereign Security</h2>
            <p>A high-value autonomous mission requires your explicit authorization.</p>
            <div style="background: #181818; padding: 15px; border-radius: 6px; border: 1px solid rgba(212,175,55,0.3); text-align: center; margin: 20px 0;">
              <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #f4d37a;">${otp}</span>
            </div>
            <p style="font-size: 12px; color: #888;">If you did not initiate this transaction, please freeze your wallet immediately via the dashboard.</p>
          </div>
        `,
      });
      console.log(`✅ Real Email OTP sent successfully to ${TARGET_EMAIL}. Code: ${otp}`);
    } catch (error) {
      console.error('❌ Nodemailer Email Error:', error);
    }
  },

  initiateBrowserCall(roleName: string): void {
    console.log(`📞 [System] Emitting browser call notification for ${roleName}...`);
  },

  validateOTP(missionId: string, otp: string): boolean {
    const mission = Store.getMission(missionId);
    if (!mission) return false;

    const expected = (mission as any).expectedOtp;
    const expiresAt = (mission as any).otpExpiresAt as number | undefined;
    const attempts = (mission as any).otpAttempts as number | undefined;

    if (!expected || !expiresAt) return false;

    // Check expiry
    if (Date.now() > expiresAt) {
      Store.addLog('OTP expired – request a new one.', 'error');
      return false;
    }

    // Check attempt limit
    if (attempts && attempts >= MAX_OTP_ATTEMPTS) {
      Store.addLog('OTP attempts exceeded – verification blocked.', 'error');
      return false;
    }

    const cleanInput = otp ? otp.trim() : '';
    if (expected === cleanInput) {
      return true;
    }

    // Record failed attempt
    (mission as any).otpAttempts = (attempts || 0) + 1;
    Store.updateMission(mission);
    return false;
  },

  emitVerificationUpdate(
    missionId: string,
    payload: { level: string; message: string; otp?: string }
  ) {
    TerminalLogger.broadcast('verification_update', {
      missionId,
      ...payload,
    });
  },
};