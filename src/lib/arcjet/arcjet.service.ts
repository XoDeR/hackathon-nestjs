import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import arcjet, { shield, fixedWindow, type ArcjetDecision } from '@arcjet/node';
import type { IncomingMessage } from 'node:http';

import 'dotenv/config';

type ArcjetMode = 'LIVE' | 'DRY_RUN';

@Injectable()
export class ArcjetService implements OnModuleInit {
  private readonly logger = new Logger(ArcjetService.name);
  private readonly client: ReturnType<typeof arcjet>;

  constructor() {
    const key = process.env.ARCJET_KEY;
    if (!key) {
      throw new Error('ARCJET_KEY is not set');
    }

    const mode: ArcjetMode = process.env.ARCJET_MODE === 'LIVE' ? 'LIVE' : 'DRY_RUN';
    const window = process.env.ARCJET_RATE_LIMIT_WINDOW ?? '1m';
    const max = Number(process.env.ARCJET_RATE_LIMIT_MAX ?? 60);

    this.client = arcjet({
      key,
      rules: [
        shield({ mode }),
        fixedWindow({ mode, window, max }),
      ],
    });
  }

  onModuleInit() {
    this.logger.log(
      `Arcjet initialized (env=${process.env.ARCJET_ENV ?? 'unknown'}, mode=${process.env.ARCJET_MODE ?? 'DRY_RUN'})`,
    );
  }

  async protect(request: IncomingMessage): Promise<ArcjetDecision> {
    return this.client.protect(request);
  }
}
