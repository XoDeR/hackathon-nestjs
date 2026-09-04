import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ArcjetModule } from './lib/arcjet/arcjet.module.js';
import { PrismaModule } from './lib/database/prisma.module.js';
import { AuthModule } from './lib/auth/auth.module.js';
import { UsersModule } from './module/users/users.module.js';
import { ArcjetGuard } from './common/guards/arcjet.guard.js';

@Module({
  imports: [ArcjetModule, PrismaModule, AuthModule, UsersModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ArcjetGuard }],
})
export class AppModule {}
