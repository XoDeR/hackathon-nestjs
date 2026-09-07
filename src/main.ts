import { NestFactory, Reflector } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

process.loadEnvFile();

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): { property: string; message: string }[] {
  return errors.flatMap((error) => {
    const property = parentPath ? `${parentPath}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({
      property,
      message,
    }));
    const nested = error.children?.length
      ? flattenValidationErrors(error.children, property)
      : [];
    return [...own, ...nested];
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException(flattenValidationErrors(errors)),
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
