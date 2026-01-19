import { Module } from '@nestjs/common'
import { WbService } from './wb.service'

@Module({
	providers: [WbService]
})
export class WbModule {}
