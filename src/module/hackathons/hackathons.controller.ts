import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  AllowAnonymous,
  Roles,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { Role } from '../../generated/prisma/enums.js';
import { CreateHackathonDto } from './dto/create-hackathon.dto.js';
import { UpdateHackathonDto } from './dto/update-hackathon.dto.js';
import { HackathonsService } from './hackathons.service.js';

@Controller('hackathons')
export class HackathonsController {
  constructor(private readonly hackathonsService: HackathonsService) {}

  @Get()
  @AllowAnonymous()
  @ResponseMessage('Fetch all hackathons')
  findAll() {
    return this.hackathonsService.findAll();
  }

  @Get(':id')
  @AllowAnonymous()
  findOne(@Param('id') id: string) {
    return this.hackathonsService.findOne(id);
  }

  @Post()
  @Roles([Role.ADMIN])
  @ResponseMessage('Hackathon created')
  create(@Body() dto: CreateHackathonDto, @Session() session: UserSession) {
    return this.hackathonsService.create(session.user.id, dto);
  }

  @Patch(':id')
  @Roles([Role.ADMIN])
  @ResponseMessage('Hackathon updated')
  update(@Param('id') id: string, @Body() dto: UpdateHackathonDto) {
    return this.hackathonsService.update(id, dto);
  }

  @Delete(':id')
  @Roles([Role.ADMIN])
  @ResponseMessage('Hackathon deleted')
  remove(@Param('id') id: string) {
    return this.hackathonsService.remove(id);
  }

  @Post(':id/join')
  @ResponseMessage('Joined hackathon')
  join(@Param('id') id: string, @Session() session: UserSession) {
    return this.hackathonsService.join(id, session.user.id);
  }
}
