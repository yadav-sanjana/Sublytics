import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    // `beforeExit` isn't typed in some Prisma Client builds; keep runtime behavior.
    this.$on('beforeExit' as never, async () => {
      await app.close();
    });
  }
}

