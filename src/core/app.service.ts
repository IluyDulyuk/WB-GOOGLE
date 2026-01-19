import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { GoogleService } from 'src/modules/google/google.service'
import { WbService } from 'src/modules/wb/wb.service'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

@Injectable()
export class AppService {
	private readonly logger = new Logger(AppService.name)

	public constructor(
		private readonly configService: ConfigService,
		private readonly googleService: GoogleService,
		private readonly wbService: WbService
	) {}

	async onApplicationBootstrap() {
		await this.cron()
	}

	@Cron(CronExpression.EVERY_10_MINUTES)
	public async cron() {
		this.logger.log('>>> Запуск синхронизации...')

		const sheets = await this.googleService.getAllSheets(
			this.configService.getOrThrow<string>('GOOGLE_FOLDER_ID')
		)

		if (sheets.length === 0) return

		this.logger.log('>>> Таблицы получены...')

		for (const sheet of sheets) {
			const settings = await this.googleService.getSheetSettings(sheet.id)

			if (!settings || settings.length === 0) continue

			const auctionCampaignId = settings[0] ? settings[0][0] : null
			const arcCampaignId = settings[2] ? settings[1][0] : null
			const sku = settings[2] ? settings[2][0] : null

			if (
				auctionCampaignId === null ||
				arcCampaignId === null ||
				sku === null
			) {
				continue
			}

			this.logger.log('>>> Настроки для таблицы получены...')
			this.logger.log('>>> Начинаю запрос данных с API WB...')
			this.logger.log('>>> Запрашиваю auctionFullstats...')

			const auctionFullstats = await this.wbService.getFullstats({
				ids: [auctionCampaignId]
			})

			await sleep(1000 * 65)

			this.logger.log('>>> Запрашиваю arcFullstats...')

			const arcFullstats = await this.wbService.getFullstats({
				ids: [arcCampaignId]
			})

			this.logger.log('>>> Запрашиваю funnelStats...')

			const funnelStats = await this.wbService.getFunnelStats(sku)

			this.logger.log('>>> Запрашиваю stocks...')

			const stocks = await this.wbService.getStocks(sku)

			if (
				auctionFullstats === null ||
				arcFullstats === null ||
				funnelStats === null ||
				stocks === null
			) {
				continue
			}

			this.logger.log('>>> Данные с API WB успешно получены...')
			this.logger.log('>>> Начинаю обновление таблицы...')

			await this.googleService.updateTable(
				sheet.id,
				auctionFullstats,
				arcFullstats,
				funnelStats,
				stocks
			)
		}
	}
}
