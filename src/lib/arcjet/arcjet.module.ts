import { Global, Module } from '@nestjs/common';
import { ArcjetService } from './arcjet.service.js';

@Global()
@Module({
  providers: [ArcjetService],
  exports: [ArcjetService],
})
export class ArcjetModule {}
