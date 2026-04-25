import { z } from 'zod';

const intFromString = z
  .string()
  .regex(/^\d+$/)
  .transform((v) => Number.parseInt(v, 10));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: intFromString.default(3000),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_TOKEN_SECRET: z.string().min(20),
  JWT_ACCESS_TOKEN_TTL_SECONDS: intFromString.default(900),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_BASIC: z.string().min(1),
  STRIPE_PRICE_PRO: z.string().min(1),

  AWS_REGION: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

