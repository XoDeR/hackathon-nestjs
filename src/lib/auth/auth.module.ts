import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthNestModule } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../database/prisma.service.js';
import { createAuth } from './auth.js';

@Module({
  imports: [
    BetterAuthNestModule.forRootAsync({
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        auth: createAuth(prisma),
        bodyParser: {
          json: {},
          urlencoded: { extended: true },
        },
      }),
    }),
  ],
})
export class AuthModule {}
