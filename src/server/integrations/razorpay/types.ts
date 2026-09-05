/**
 * Razorpay Integration Types & Data Contracts
 * Defines payloads and response interfaces conforming to official Razorpay API specifications.
 */

export interface RazorpayPaymentLinkPayload {
  amount: number; // in paise (e.g. 240000 = ₹2,400)
  currency: string;
  reference_id: string;
  description: string;
  customer: {
    name: string;
    email: string;
    contact: string;
  };
  notify?: {
    sms?: boolean;
    email?: boolean;
    whatsapp?: boolean;
  };
  notes?: Record<string, string>;
}

export interface RazorpayPaymentLinkResponse {
  id: string; // e.g. "plink_TXXcpV0vJUPlYg"
  short_url: string; // e.g. "https://rzp.io/rzp/ey2eXM0U"
  status: string; // "created" | "paid" | "partially_paid" | "expired" | "cancelled"
  amount: number;
  currency: string;
  reference_id: string;
  created_at: number;
  customer: {
    name: string;
    email: string;
    contact: string;
  };
  isSimulated: boolean;
  adapter: string;
  rawResponse?: Record<string, any>;
}

export interface RazorpayOrderPayload {
  amount: number; // in paise
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string; // "order_..."
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
  isSimulated: boolean;
  adapter: string;
}

export interface RazorpayCaptureResponse {
  id: string; // "pay_..."
  entity: string;
  amount: number;
  currency: string;
  status: 'captured';
  order_id?: string;
  method?: string;
  captured: boolean;
  created_at: number;
  isSimulated: boolean;
  adapter: string;
}

export interface IRazorpayAdapter {
  isSimulated: boolean;
  adapterName: string;
  createPaymentLink(payload: RazorpayPaymentLinkPayload): Promise<RazorpayPaymentLinkResponse>;
  createOrder(payload: RazorpayOrderPayload): Promise<RazorpayOrderResponse>;
  capturePayment(paymentId: string, amount: number, currency: string, currentStatus?: string): Promise<RazorpayCaptureResponse>;
}
