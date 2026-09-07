import { Controller } from '@nestjs/common';
import { HackathonsService } from './hackathons.service.js';

@Controller('hackathons')
export class HackathonsController {
  constructor(private readonly hackathonsService: HackathonsService) {}
}
