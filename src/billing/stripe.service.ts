import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Stripe as StripeType } from 'stripe';

@Injectable()
export class StripeService {
  readonly client: StripeType;

  constructor(config: ConfigService) {
    const key = config.get<string>('STRIPE_SECRET_KEY');
    if (!key) throw new Error('STRIPE_SECRET_KEY is missing');

    this.client = new Stripe(key, {
      // Keep pinned for consistent webhook event shapes.
      apiVersion: '2026-04-22.dahlia',
      typescript: true,
    });
  }
}

