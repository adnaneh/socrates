import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { getCorsOrigin } from "./config/cors";

async function bootstrap() {
  const parsedOrigin = getCorsOrigin();

  const app = await NestFactory.create(AppModule, {
    cors: { origin: parsedOrigin, credentials: true },
  });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("Chat API")
      .setDescription("API for chat application with MCP tools")
      .setVersion("1.0")
      .build();
    SwaggerModule.setup(
      "api-docs",
      app,
      SwaggerModule.createDocument(app, config),
    );
  }

  const port = Number(process.env.PORT) || 3000;
  
  await app.listen(port, "::");
}
bootstrap();
