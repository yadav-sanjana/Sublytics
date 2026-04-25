import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  async processEvent(event: any) {
    const already = await this.prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });
    if (already?.processedAt) return;

    await this.prisma.stripeWebhookEvent.upsert({
      where: { stripeEventId: event.id },
      create: { stripeEventId: event.id, type: event.type },
      update: { type: event.type },
    });

    try {
      switch (event.type) {
        case 'invoice.paid':
          await this.onInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.onInvoicePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.onSubscriptionUpdated(event.data.object);
          break;
        default:
          break;
      }

      await this.prisma.stripeWebhookEvent.update({
        where: { stripeEventId: event.id },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      this.logger.error({ err, eventId: event.id, type: event.type }, 'stripe webhook failed');
      throw err;
    }
  }

  private async findUserIdByCustomer(customer: any) {
    const customerId = typeof customer === 'string' ? customer : customer?.id;
    if (!customerId) return null;
    const user = await this.prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
    return user?.id ?? null;
  }

  private mapPaymentStatus(invoice: any, paymentIntent?: any | null): PaymentStatus {
    if (invoice.paid) return PaymentStatus.succeeded;
    const piStatus = paymentIntent?.status;
    switch (piStatus) {
      case 'requires_payment_method':
        return PaymentStatus.requires_payment_method;
      case 'requires_confirmation':
        return PaymentStatus.requires_confirmation;
      case 'requires_action':
        return PaymentStatus.requires_action;
      case 'processing':
        return PaymentStatus.processing;
      case 'canceled':
        return PaymentStatus.canceled;
      default:
        return PaymentStatus.failed;
    }
  }

  private mapSubscriptionStatus(status: any): SubscriptionStatus {
    // Prisma enum mirrors Stripe names.
    return status as unknown as SubscriptionStatus;
  }

  private async upsertSubscriptionFromStripe(sub: any) {
    const userIdFromMetadata =
      sub.metadata?.userId && /^\d+$/.test(sub.metadata.userId) ? Number.parseInt(sub.metadata.userId, 10) : null;

    const priceId =
      sub.items.data?.[0]?.price?.id ??
      sub.items.data?.[0]?.plan?.id ??
      null;

    const userId =
      userIdFromMetadata ??
      (await this.prisma.user
        .findUnique({ where: { stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id } })
        .then((u) => u?.id ?? null));

    if (!userId) {
      this.logger.warn({ stripeSubscriptionId: sub.id }, 'subscription webhook: user not found');
      return null;
    }

    return this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      create: {
        userId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId ?? 'unknown',
        status: this.mapSubscriptionStatus(sub.status),
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      },
      update: {
        stripePriceId: priceId ?? undefined,
        status: this.mapSubscriptionStatus(sub.status),
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      },
    });
  }

  private async onSubscriptionUpdated(sub: any) {
    await this.upsertSubscriptionFromStripe(sub);
  }

  private async onInvoicePaid(invoice: any) {
    const userId = await this.findUserIdByCustomer(invoice.customer);
    if (!userId) {
      this.logger.warn({ invoiceId: invoice.id }, 'invoice.paid: user not found');
      return;
    }

    const stripeSubscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null;

    const dbSub = stripeSubscriptionId
      ? await this.prisma.subscription.findUnique({ where: { stripeSubscriptionId } })
      : null;

    // Pull payment intent if present (invoice may not include expanded PI in webhooks by default)
    const paymentIntentId =
      typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent?.id ?? null;
    const paymentIntent = paymentIntentId
      ? await this.stripe.client.paymentIntents.retrieve(paymentIntentId)
      : null;

    await this.prisma.payment.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        userId,
        subscriptionId: dbSub?.id ?? null,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: paymentIntentId,
        amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
        currency: invoice.currency ?? 'usd',
        status: this.mapPaymentStatus(invoice, paymentIntent),
        paidAt: new Date((invoice.status_transitions?.paid_at ?? invoice.created) * 1000),
      },
      update: {
        subscriptionId: dbSub?.id ?? null,
        stripePaymentIntentId: paymentIntentId,
        amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
        currency: invoice.currency ?? 'usd',
        status: this.mapPaymentStatus(invoice, paymentIntent),
        paidAt: new Date((invoice.status_transitions?.paid_at ?? invoice.created) * 1000),
      },
    });

    if (stripeSubscriptionId) {
      // Keep subscription status in sync from invoice context if available.
      const stripeSub = await this.stripe.client.subscriptions.retrieve(stripeSubscriptionId);
      await this.upsertSubscriptionFromStripe(stripeSub);
    }
  }

  private async onInvoicePaymentFailed(invoice: any) {
    const userId = await this.findUserIdByCustomer(invoice.customer);
    if (!userId) {
      this.logger.warn({ invoiceId: invoice.id }, 'invoice.payment_failed: user not found');
      return;
    }

    const stripeSubscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null;
    const dbSub = stripeSubscriptionId
      ? await this.prisma.subscription.findUnique({ where: { stripeSubscriptionId } })
      : null;

    const paymentIntentId =
      typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent?.id ?? null;
    const paymentIntent = paymentIntentId
      ? await this.stripe.client.paymentIntents.retrieve(paymentIntentId)
      : null;

    await this.prisma.payment.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        userId,
        subscriptionId: dbSub?.id ?? null,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: paymentIntentId,
        amount: invoice.amount_due ?? 0,
        currency: invoice.currency ?? 'usd',
        status: this.mapPaymentStatus(invoice, paymentIntent),
        paidAt: null,
      },
      update: {
        subscriptionId: dbSub?.id ?? null,
        stripePaymentIntentId: paymentIntentId,
        amount: invoice.amount_due ?? 0,
        currency: invoice.currency ?? 'usd',
        status: this.mapPaymentStatus(invoice, paymentIntent),
        paidAt: null,
      },
    });

    if (stripeSubscriptionId) {
      const stripeSub = await this.stripe.client.subscriptions.retrieve(stripeSubscriptionId);
      await this.upsertSubscriptionFromStripe(stripeSub);
    }
  }
}

