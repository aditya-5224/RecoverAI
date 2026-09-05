/**
 * Razorpay Webhook Ingestion & Reconciliation Service
 * Enforces raw body HMAC-SHA256 signature verification, event deduplication,
 * and state transition from AWAITING_PAYMENT to RECOVERED with verified amounts.
 */

import { razorpayService } from './razorpay/service.ts';
import { db } from '../db/database.ts';
import { revenueDetector } from '../detection/detector.ts';
import { RecoveryCaseStatus } from '../../types/index.ts';

export interface WebhookProcessResult {
  statusCode: number;
  success: boolean;
  received: boolean;
  duplicate?: boolean;
  verified?: boolean;
  event?: string;
  eventId?: string;
  reconciledCaseId?: string;
  recoveredAmount?: number;
  error?: string;
}

export class RazorpayWebhookHandler {
  processWebhook(params: {
    rawBody: string;
    signature?: string;
    eventId?: string;
    parsedBody: Record<string, any>;
  }): WebhookProcessResult {
    const { rawBody, signature = '', parsedBody } = params;
    const event = parsedBody?.event || 'unknown';
    const payload = parsedBody?.payload || {};
    const eventId = params.eventId || (parsedBody as any)?.id || `wh_evt_${Date.now()}`;

    // 1. Strict HMAC-SHA256 Signature Verification using raw body
    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      db.logAuditEvent({
        correlationId: `corr_wh_rej_${Date.now()}`,
        eventType: 'WEBHOOK_RECEIVED',
        actor: 'RAZORPAY_WEBHOOK',
        input: { event, eventId, signatureReceived: !!signature },
        decision: 'Rejected: Webhook signature verification failed',
        reason: 'HMAC-SHA256 mismatch against configured webhook secret',
        result: { status: 'REJECTED', httpCode: 400 },
      });
      return {
        statusCode: 400,
        success: false,
        received: false,
        verified: false,
        error: 'Invalid webhook signature',
      };
    }

    // 2. Strict Event Deduplication via Event ID
    if (eventId && db.hasProcessedWebhookEvent(eventId)) {
      db.logAuditEvent({
        correlationId: `corr_wh_dup_${eventId}`,
        eventType: 'WEBHOOK_RECEIVED',
        actor: 'RAZORPAY_WEBHOOK',
        input: { event, eventId },
        decision: 'Skipped: Duplicate webhook event detected',
        reason: `Event ID ${eventId} has already been reconciled into the system`,
        result: { status: 'DUPLICATE_SKIPPED' },
      });
      return {
        statusCode: 200,
        success: true,
        received: true,
        duplicate: true,
        verified: true,
        event,
        eventId,
      };
    }

    // 3. Reconcile Event Payloads
    const paymentEntity = payload.payment?.entity;
    let reconciledCaseId: string | undefined;
    let recoveredAmount: number | undefined;

    if (event === 'payment.failed' && paymentEntity) {
      const orderId = paymentEntity.order_id;
      const existingOrder = orderId ? db.getOrderByRazorpayId(orderId) : undefined;

      // Protection: If order is already paid, do not create duplicate recovery case
      if (existingOrder?.status === 'paid') {
        db.logAuditEvent({
          correlationId: `corr_wh_paid_${eventId}`,
          eventType: 'WEBHOOK_RECEIVED',
          actor: 'RAZORPAY_WEBHOOK',
          input: { event, paymentId: paymentEntity.id, orderId },
          decision: 'No recovery case created: Target order is already fully paid',
          reason: 'Order was previously satisfied by an alternate successful transaction',
          result: { status: 'IGNORED_ALREADY_PAID' },
        });
      } else {
        revenueDetector.ingestPaymentFailure({
          razorpayPaymentId: paymentEntity.id,
          razorpayOrderId: paymentEntity.order_id,
          amount: (paymentEntity.amount || 0) / 100, // paise to INR
          currency: paymentEntity.currency || 'INR',
          method: paymentEntity.method || 'upi',
          failureCode: paymentEntity.error_code || 'GATEWAY_ERROR',
          failureReason: paymentEntity.error_description || 'Payment failed during processing',
          customerEmail: paymentEntity.email,
          customerPhone: paymentEntity.contact,
        });
      }
    } else if (event === 'payment_link.paid' || (event === 'payment.captured' && payload.payment_link)) {
      // Reconcile official Razorpay Payment Link completion
      const plink = payload.payment_link?.entity;
      const plinkId = plink?.id;
      const refId = plink?.reference_id;
      if (plinkId || refId) {
        const allCases = db.listRecoveryCases();
        const targetCase = allCases.find(
          (c) => (plinkId && c.paymentLinkId === plinkId) || (refId && c.paymentLinkReferenceId === refId)
        );

        if (targetCase && targetCase.status !== RecoveryCaseStatus.RECOVERED) {
          // Invariant: Never mark revenue recovered unless a valid positive payment amount
          // has been obtained from the verified Razorpay payment event.
          // Fallback to amountAtRisk is strictly forbidden to prevent manufactured recoveries from zero/missing/malformed amounts.
          const rawAmount = plink?.amount_paid ?? paymentEntity?.amount ?? plink?.amount;
          const amountPaidPaise = typeof rawAmount === 'number' && Number.isFinite(rawAmount) ? rawAmount : 0;

          if (amountPaidPaise <= 0) {
            db.logAuditEvent({
              caseId: targetCase.id,
              correlationId: `corr_wh_invalid_amt_${eventId}`,
              eventType: 'WEBHOOK_RECEIVED',
              actor: 'RAZORPAY_WEBHOOK',
              input: { event, eventId, rawAmount, paymentLinkId: plinkId },
              decision: 'Rejected: Payment link completion missing valid positive amount from Razorpay event',
              reason: 'Zero, missing, negative, or non-numeric amount received in webhook payload. Fallback to amountAtRisk is forbidden.',
              result: { status: 'INVALID_AMOUNT_REJECTED', recovered: false },
            });

            db.markWebhookEventProcessed(eventId);

            return {
              statusCode: 422,
              success: false,
              received: true,
              verified: true,
              event,
              eventId,
              error: 'Missing or invalid positive payment amount in webhook payload',
            };
          }

          const verifiedPaidAmount = amountPaidPaise / 100;

          targetCase.status = RecoveryCaseStatus.RECOVERED;
          targetCase.amountRecovered = verifiedPaidAmount;
          targetCase.recoveryProvenance = 'RAZORPAY_WEBHOOK';
          targetCase.verifiedWebhookEventId = eventId;
          targetCase.verifiedPaymentLinkId = plinkId || targetCase.paymentLinkId;
          targetCase.verifiedPaymentId = paymentEntity?.id || undefined;
          targetCase.verifiedAmount = verifiedPaidAmount;
          targetCase.completedAt = new Date().toISOString();
          db.saveRecoveryCase(targetCase);

          if (targetCase.orderId) {
            const order = db.getOrder(targetCase.orderId);
            if (order) {
              order.status = 'paid';
              order.updatedAt = new Date().toISOString();
              db.saveOrder(order);
            }
          }

          reconciledCaseId = targetCase.id;
          recoveredAmount = verifiedPaidAmount;

          db.logAuditEvent({
            caseId: targetCase.id,
            correlationId: `corr_wh_plink_${eventId}`,
            eventType: 'PAYMENT_RECOVERED',
            actor: 'RAZORPAY_WEBHOOK',
            input: { event, paymentLinkId: plinkId, referenceId: refId, verifiedAmountPaid: verifiedPaidAmount },
            decision: `Payment link ${plinkId} completed by customer. Recovery case transitioned to RECOVERED with verified ₹${verifiedPaidAmount.toLocaleString('en-IN')}.`,
            reason: 'Verified official Razorpay payment_link.paid webhook event',
            result: { caseId: targetCase.id, status: 'RECOVERED', amountRecovered: targetCase.amountRecovered },
          });
        }
      }
    } else if (event === 'payment.captured' && paymentEntity) {
      // Reconcile captured payment
      const existingPayment = db.getPaymentByRazorpayId(paymentEntity.id);
      if (existingPayment) {
        existingPayment.status = 'captured';
        existingPayment.capturedAt = new Date().toISOString();
        db.savePayment(existingPayment);
      }
      if (paymentEntity.order_id) {
        const existingOrder = db.getOrderByRazorpayId(paymentEntity.order_id);
        if (existingOrder) {
          existingOrder.status = 'paid';
          existingOrder.updatedAt = new Date().toISOString();
          db.saveOrder(existingOrder);
        }
      }
    }

    // 4. Mark event as processed to prevent replay/duplicate recovery
    db.markWebhookEventProcessed(eventId);

    db.logAuditEvent({
      correlationId: `corr_wh_proc_${eventId}`,
      eventType: 'WEBHOOK_RECEIVED',
      actor: 'RAZORPAY_WEBHOOK',
      input: { event, eventId, paymentId: paymentEntity?.id },
      decision: `Successfully processed and verified webhook event: ${event}`,
      reason: 'Valid HMAC-SHA256 signature and unhandled unique event ID',
      result: { event, eventId, status: 'PROCESSED' },
    });

    return {
      statusCode: 200,
      success: true,
      received: true,
      verified: true,
      event,
      eventId,
      reconciledCaseId,
      recoveredAmount,
    };
  }
}

export const razorpayWebhookHandler = new RazorpayWebhookHandler();
