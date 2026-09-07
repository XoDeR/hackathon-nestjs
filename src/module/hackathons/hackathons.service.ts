import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../lib/database/prisma.service.js';
import type { CreateHackathonDto } from './dto/create-hackathon.dto.js';
import type { UpdateHackathonDto } from './dto/update-hackathon.dto.js';

const authorSelect = {
  id: true,
  name: true,
  image: true,
} as const;

@Injectable()
export class HackathonsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.hackathon.findMany({
      orderBy: { startDate: 'desc' },
      include: { author: { select: authorSelect } },
    });
  }

  async findOne(id: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id },
      include: {
        author: { select: authorSelect },
        participants: {
          orderBy: { joinedAt: 'asc' },
          include: { user: { select: authorSelect } },
        },
      },
    });

    if (!hackathon) {
      throw new NotFoundException(`Hackathon ${id} not found`);
    }

    return hackathon;
  }

  create(authorId: string, dto: CreateHackathonDto) {
    this.assertDateRange(dto.startsAt, dto.endsAt);

    return this.prisma.hackathon.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startsAt,
        endDate: dto.endsAt,
        isActive: dto.isActive ?? false,
        authorId,
      },
      include: { author: { select: authorSelect } },
    });
  }

  async update(id: string, dto: UpdateHackathonDto) {
    const hackathon = await this.findOne(id);

    const startDate = dto.startsAt ?? hackathon.startDate;
    const endDate = dto.endsAt ?? hackathon.endDate;
    this.assertDateRange(startDate, endDate);

    return this.prisma.hackathon.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startsAt,
        endDate: dto.endsAt,
        isActive: dto.isActive,
      },
      include: { author: { select: authorSelect } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.hackathon.delete({ where: { id } });
  }

  async join(id: string, userId: string) {
    const hackathon = await this.findOne(id);

    if (!hackathon.isActive) {
      throw new ForbiddenException('This hackathon is not accepting participants');
    }

    const existing = await this.prisma.hackathonParticipant.findUnique({
      where: { hackathonId_userId: { hackathonId: id, userId } },
    });

    if (existing) {
      throw new ConflictException('You have already joined this hackathon');
    }

    return this.prisma.hackathonParticipant.create({
      data: { hackathonId: id, userId },
    });
  }

  private assertDateRange(startDate: Date, endDate: Date) {
    if (endDate <= startDate) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }
}
