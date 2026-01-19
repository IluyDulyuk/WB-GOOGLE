import { NestFactory } from '@nestjs/core'
import { AppModule } from './core/app.module'

async function bootstrap() {
	const app = await NestFactory.createApplicationContext(AppModule)
}
bootstrap()
