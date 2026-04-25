import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { SubscriptionStatus } from '@prisma/client';

export enum BillingPlan {
  basic = 'basic',
  pro = 'pro',
}

registerEnumType(BillingPlan, { name: 'BillingPlan' });
registerEnumType(SubscriptionStatus, { name: 'SubscriptionStatus' });

@ObjectType()
export class SetupIntentPayload {
  @Field()
  clientSecret!: string;
}

@ObjectType()
export class Subscription {
  @Field()
  id!: number;

  @Field()
  stripeSubscriptionId!: string;

  @Field()
  stripePriceId!: string;

  @Field(() => SubscriptionStatus)
  status!: SubscriptionStatus;

  @Field()
  cancelAtPeriodEnd!: boolean;

  @Field({ nullable: true })
  currentPeriodStart?: Date;

  @Field({ nullable: true })
  currentPeriodEnd?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class SubscriptionCreatePayload {
  @Field(() => Subscription)
  subscription!: Subscription;

  // If the subscription needs an initial payment confirmation (e.g. no default PM),
  // Stripe will return a PaymentIntent client_secret via latest_invoice.payment_intent.
  @Field({ nullable: true })
  initialPaymentClientSecret?: string;
}

