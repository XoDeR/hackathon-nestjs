import { Controller, Get } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

@Controller('users')
export class UsersController {
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
}
