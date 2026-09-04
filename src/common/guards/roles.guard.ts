import { Injectable, UnauthorizedException, ForbiddenException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { Role } from '../../generated/prisma/enums.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ session?: UserSession }>();
    const user = request.session?.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!requiredRoles.includes((user as { role: Role }).role)) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
