import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ArcjetService } from '../../lib/arcjet/arcjet.service.js';

@Injectable()
export class ArcjetGuard implements CanActivate {
  constructor(private readonly arcjetService: ArcjetService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const decision = await this.arcjetService.protect(request);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new ForbiddenException('Request blocked by Arcjet');
    }

    return true;
  }
}
