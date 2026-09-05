/**
 * Razorpay Simulation Adapter
 * Strictly isolated adapter for offline testing, sandboxing, and controlled failure simulation.
 * Clearly marked as isSimulated: true.
 * NEVER represents simulated outputs as real Razorpay Test Mode execution.
 */

import {
  IRazorpayAdapter,
  RazorpayCaptureResponse,
  RazorpayOrderPayload,
  RazorpayOrderResponse,
  RazorpayPaymentLinkPayload,
  RazorpayPaymentLinkResponse,
} from './types.ts';

export class RazorpaySimulationAdapter implements IRazorpayAdapter {
  readonly isSimulated = true;
  readonly adapterName = 'RazorpaySimulationAdapter (Internal Simulation Only)';

  async createPaymentLink(payload: RazorpayPaymentLinkPayload): Promise<RazorpayPaymentLinkResponse> {
    const timestamp = Math.floor(Date.now() / 1000);
    return {
      id: `plink_sim_${timestamp}`,
      short_url: `https://rzp.io/i/sim_${timestamp}`,
      status: 'created',
      amount: payload.amount,
      currency: payload.currency || 'INR',
      reference_id: payload.reference_id,
      created_at: timestamp,
      customer: {
        name: payload.customer.name,
        email: payload.customer.email,
        contact: payload.customer.contact,
      },
      isSimulated: true,
      adapter: this.adapterName,
    };
  }

  async createOrder(payload: RazorpayOrderPayload): Promise<RazorpayOrderResponse> {
    const timestamp = Math.floor(Date.now() / 1000);
    return {
      id: `order_sim_${timestamp}`,
      entity: 'order',
      amount: payload.amount,
      amount_paid: 0,
      amount_due: payload.amount,
      currency: payload.currency || 'INR',
      receipt: payload.receipt,
      status: 'created',
      created_at: timestamp,
      isSimulated: true,
      adapter: this.adapterName,
    };
  }

  async capturePayment(
    paymentId: string,
    amount: number,
    currency = 'INR',
    currentStatus?: string
  ): Promise<RazorpayCaptureResponse> {
    if (currentStatus && currentStatus !== 'authorized') {
      throw new Error(
        `INVALID_PAYMENT_STATE: Cannot capture payment ${paymentId} with status "${currentStatus}". Only AUTHORIZED payments can be captured.`
      );
    }

    return {
      id: paymentId,
      entity: 'payment',
      amount: Math.round(amount * 100),
      currency,
      status: 'captured',
      captured: true,
      created_at: Math.floor(Date.now() / 1000),
      isSimulated: true,
      adapter: this.adapterName,
    };
  }
}
