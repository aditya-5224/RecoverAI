/**
 * Razorpay Test Mode Service Layer
 * Strict encapsulation of official Razorpay Orders, Payment Links, and Webhook verification.
 * Adheres 100% to documented Razorpay APIs:
 * - POST https://api.razorpay.com/v1/payment_links
 * - POST https://api.razorpay.com/v1/orders
 * - POST https://api.razorpay.com/v1/payments/:id/capture (Only for AUTHORIZED payments)
 *
 * Fabricated endpoints (such as /v1/payments/recovery) are strictly forbidden.
 */

import crypto from 'crypto';
import {
  IRazorpayAdapter,
  RazorpayCaptureResponse,
  RazorpayOrderPayload,
  RazorpayOrderResponse,
  RazorpayPaymentLinkPayload,
  RazorpayPaymentLinkResponse,
} from './types.ts';
import { RazorpayTestModeAdapter } from './testModeAdapter.ts';
import { RazorpaySimulationAdapter } from './simulationAdapter.ts';

export class RazorpayService {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;
  private isTestEnv: boolean;
  private testModeAdapter?: RazorpayTestModeAdapter;
  private simulationAdapter: RazorpaySimulationAdapter;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_wh_sec_recoverai_2026';
    const env = process.env.RAZORPAY_ENV || 'test';

    // Safety Gate: Reject live credentials in development/hackathon environment
    if (this.keyId.startsWith('rzp_live_') && env !== 'production') {
      throw new Error(
        'SECURITY_VIOLATION: Live Razorpay credentials detected in Test Mode environment. Aborting startup.'
      );
    }

    this.isTestEnv = env === 'test' || this.keyId.startsWith('rzp_test_');
    this.simulationAdapter = new RazorpaySimulationAdapter();

    if (this.keyId.startsWith('rzp_test_') && this.keySecret) {
      this.testModeAdapter = new RazorpayTestModeAdapter(this.keyId, this.keySecret);
    }
  }

  isTestMode(): boolean {
    return this.isTestEnv;
  }

  hasRealCredentials(): boolean {
    return !!(this.testModeAdapter && this.keyId.startsWith('rzp_test_') && this.keySecret);
  }

  getKeyId(): string {
    return this.keyId ? `${this.keyId.substring(0, 8)}...` : 'UNCONFIGURED';
  }

  /**
   * Returns active adapter being utilized
   */
  getActiveAdapter(forceSimulation = false): IRazorpayAdapter {
    if (forceSimulation || !this.testModeAdapter) {
      return this.simulationAdapter;
    }
    return this.testModeAdapter;
  }

  /**
   * Generate HMAC-SHA256 signature for webhook testing & verification
   */
  generateWebhookSignature(bodyString: string): string {
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(bodyString)
      .digest('hex');
  }

  /**
   * Verify Razorpay Webhook signature using timing-safe HMAC-SHA256 comparison
   * Official standard: hmac_sha256(request_body, webhook_secret) === x-razorpay-signature
   */
  verifyWebhookSignature(bodyString: string, signatureHeader: string): boolean {
    if (!signatureHeader || !this.webhookSecret) {
      return false;
    }
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(bodyString)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf-8'),
        Buffer.from(signatureHeader, 'utf-8')
      );
    } catch {
      return false;
    }
  }

  /**
   * Create Razorpay Standard Payment Link
   * Official API: POST https://api.razorpay.com/v1/payment_links
   */
  async createPaymentLink(
    payload: RazorpayPaymentLinkPayload,
    options?: { forceSimulation?: boolean }
  ): Promise<RazorpayPaymentLinkResponse> {
    const adapter = this.getActiveAdapter(options?.forceSimulation);
    return adapter.createPaymentLink(payload);
  }

  /**
   * Create Razorpay Order
   * Official API: POST https://api.razorpay.com/v1/orders
   */
  async createOrder(
    payload: RazorpayOrderPayload,
    options?: { forceSimulation?: boolean }
  ): Promise<RazorpayOrderResponse> {
    const adapter = this.getActiveAdapter(options?.forceSimulation);
    return adapter.createOrder(payload);
  }

  /**
   * Capture an AUTHORIZED Razorpay payment.
   * Official API: POST https://api.razorpay.com/v1/payments/:id/capture
   *
   * CRITICAL: In Razorpay, only payments in 'authorized' status can be captured.
   * A failed payment must NEVER be sent to /capture.
   */
  async captureAuthorizedPayment(
    paymentId: string,
    amount: number,
    currency = 'INR',
    currentStatus?: string,
    options?: { forceSimulation?: boolean }
  ): Promise<RazorpayCaptureResponse> {
    if (currentStatus && currentStatus !== 'authorized') {
      throw new Error(
        `INVALID_PAYMENT_STATE: Cannot capture payment ${paymentId} with status "${currentStatus}". Only AUTHORIZED payments can be captured in Razorpay. Failed payments cannot be captured.`
      );
    }

    const adapter = this.getActiveAdapter(options?.forceSimulation);
    return adapter.capturePayment(paymentId, amount, currency, currentStatus);
  }
}

export const razorpayService = new RazorpayService();
