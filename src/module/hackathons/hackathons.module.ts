import { Module } from '@nestjs/common';
import { HackathonsService } from './hackathons.service.js';
import { HackathonsController } from './hackathons.controller.js';

@Module({
  controllers: [HackathonsController],
  providers: [HackathonsService],
  exports: [HackathonsService],
})
export class HackathonsModule {}
