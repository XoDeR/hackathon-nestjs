import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Role } from '../../generated/prisma/enums.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Session() session: UserSession) {
    const { id, email, name, role, emailVerified, image } = session.user as {
      id: string;
      email: string;
      name: string;
      role: string;
      emailVerified: boolean;
      image: string | null;
    };

    return { id, email, name, role, emailVerified, image };
  }

  @Get('all')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  getAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
