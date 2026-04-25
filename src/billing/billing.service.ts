import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BillingPlan } from './billing.graphql';
import { StripeService } from './stripe.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  private priceIdForPlan(plan: BillingPlan) {
    if (plan === BillingPlan.basic) return this.config.get<string>('STRIPE_PRICE_BASIC');
    if (plan === BillingPlan.pro) return this.config.get<string>('STRIPE_PRICE_PRO');
    return undefined;
  }

  async ensureStripeCustomer(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.client.customers.create({
      email: user.email,
      metadata: { userId: String(user.id) },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createSetupIntent(userId: number) {
    const customerId = await this.ensureStripeCustomer(userId);
    const setupIntent = await this.stripe.client.setupIntents.create({
      customer: customerId,
      usage: 'off_session',
      payment_method_types: ['card'],
    });
    if (!setupIntent.client_secret) {
      throw new BadRequestException('Stripe did not return a client secret');
    }
    return { clientSecret: setupIntent.client_secret };
  }

  async setDefaultPaymentMethod(userId: number, paymentMethodId: string) {
    const customerId = await this.ensureStripeCustomer(userId);

    await this.stripe.client.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await this.stripe.client.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    return true;
  }

  async createSubscription(userId: number, plan: BillingPlan) {
    const priceId = this.priceIdForPlan(plan);
    if (!priceId) throw new BadRequestException(`Missing Stripe price id for plan: ${plan}`);

    const customerId = await this.ensureStripeCustomer(userId);

    // Create subscription; if customer has no default PM, Stripe may require payment confirmation.
    const subscription = await this.stripe.client.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: { userId: String(userId), plan },
    });

    const latestInvoice: any = subscription.latest_invoice;
    const paymentIntent: any = latestInvoice?.payment_intent;
    const clientSecret: string | undefined = paymentIntent?.client_secret ?? undefined;

    const mappedStatus = (subscription.status ?? 'incomplete') as SubscriptionStatus;

    const dbSub = await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      create: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status: mappedStatus,
        cancelAtPeriodEnd: (subscription as any).cancelAtPeriodEnd ?? false,
        currentPeriodStart: (subscription as any).currentPeriodStart
          ? new Date((subscription as any).currentPeriodStart * 1000)
          : null,
        currentPeriodEnd: (subscription as any).currentPeriodEnd
          ? new Date((subscription as any).currentPeriodEnd * 1000)
          : null,
      },
      update: {
        stripePriceId: priceId,
        status: mappedStatus,
        cancelAtPeriodEnd: (subscription as any).cancelAtPeriodEnd ?? false,
        currentPeriodStart: (subscription as any).currentPeriodStart
          ? new Date((subscription as any).currentPeriodStart * 1000)
          : null,
        currentPeriodEnd: (subscription as any).currentPeriodEnd
          ? new Date((subscription as any).currentPeriodEnd * 1000)
          : null,
      },
    });

    return {
      subscription: dbSub,
      initialPaymentClientSecret: clientSecret,
    };
  }

  async cancelSubscription(userId: number, stripeSubscriptionId: string) {
    const dbSub = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });
    if (!dbSub || dbSub.userId !== userId) throw new NotFoundException('Subscription not found');

    const sub = await this.stripe.client.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const mappedStatus = (sub.status ?? 'canceled') as SubscriptionStatus;
    await this.prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        status: mappedStatus,
        cancelAtPeriodEnd: (sub as any).cancelAtPeriodEnd ?? true,
        currentPeriodStart: (sub as any).currentPeriodStart ? new Date((sub as any).currentPeriodStart * 1000) : null,
        currentPeriodEnd: (sub as any).currentPeriodEnd ? new Date((sub as any).currentPeriodEnd * 1000) : null,
      },
    });

    return true;
  }

  mySubscription(userId: number) {
    return this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

