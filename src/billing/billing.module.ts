import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingResolver } from './billing.resolver';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  controllers: [StripeWebhookController],
  providers: [StripeService, BillingService, BillingResolver, StripeWebhookService],
  exports: [BillingService],
})
export class BillingModule {}

