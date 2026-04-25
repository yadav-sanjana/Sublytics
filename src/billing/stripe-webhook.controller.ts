import { Controller, Headers, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly stripe: StripeService,
    private readonly webhooks: StripeWebhookService,
  ) {}

  @Post()
  async handle(@Req() req: any, @Headers('stripe-signature') signature?: string) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is missing');
    if (!signature) throw new Error('Missing stripe-signature header');

    const rawBody: Buffer = req.body; // express.raw() in main.ts
    const event = this.stripe.client.webhooks.constructEvent(rawBody, signature, secret);

    await this.webhooks.processEvent(event);
    return { received: true };
  }
}

