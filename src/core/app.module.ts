import { Module } from '@nestjs/common'
import { AppService } from './app.service'
import { ConfigModule } from '@nestjs/config'
import { GoogleService } from 'src/modules/google/google.service'
import { ScheduleModule } from '@nestjs/schedule'
import { WbService } from 'src/modules/wb/wb.service'

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		ScheduleModule.forRoot()
	],
	providers: [AppService, GoogleService, WbService]
})
export class AppModule {}
