import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingPlan, SetupIntentPayload, Subscription, SubscriptionCreatePayload } from './billing.graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Resolver()
export class BillingResolver {
  constructor(private readonly billing: BillingService) {}

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  ensureStripeCustomer(@CurrentUser() user: { id: number }) {
    return this.billing.ensureStripeCustomer(user.id).then(() => true);
  }

  @Mutation(() => SetupIntentPayload)
  @UseGuards(GqlAuthGuard)
  createSetupIntent(@CurrentUser() user: { id: number }) {
    return this.billing.createSetupIntent(user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  setDefaultPaymentMethod(
    @CurrentUser() user: { id: number },
    @Args('paymentMethodId') paymentMethodId: string,
  ) {
    return this.billing.setDefaultPaymentMethod(user.id, paymentMethodId);
  }

  @Mutation(() => SubscriptionCreatePayload)
  @UseGuards(GqlAuthGuard)
  createSubscription(@CurrentUser() user: { id: number }, @Args('plan', { type: () => BillingPlan }) plan: BillingPlan) {
    return this.billing.createSubscription(user.id, plan);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  cancelSubscription(@CurrentUser() user: { id: number }, @Args('stripeSubscriptionId') stripeSubscriptionId: string) {
    return this.billing.cancelSubscription(user.id, stripeSubscriptionId);
  }

  @Query(() => Subscription, { nullable: true })
  @UseGuards(GqlAuthGuard)
  mySubscription(@CurrentUser() user: { id: number }) {
    return this.billing.mySubscription(user.id);
  }
}

