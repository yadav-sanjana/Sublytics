import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from 'nestjs-pino';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
        const isProd = nodeEnv === 'production';
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { colorize: true, singleLine: true, translateTime: 'SYS:standard' },
                },
            redact: ['req.headers.authorization'],
          },
        };
      },
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
        const isProd = nodeEnv === 'production';
        return {
          autoSchemaFile: join(process.cwd(), 'schema.gql'),
          sortSchema: true,
          playground: !isProd,
          introspection: !isProd,
          context: ({ req }) => ({ req }),
        };
      },
    }),
    UsersModule,
    AuthModule,
    BillingModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
