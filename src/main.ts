import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

process.loadEnvFile();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
