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
		this.scheduleDailySync()
		this.cron()
	}

	private scheduleDailySync() {
		const TARGET_HOUR = 11
		const TARGET_MINUTE = 0

		// 1. Получаем текущее время в Москве
		const now = new Date()
		const mskNow = new Date(
			now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' })
		)

		// 2. Устанавливаем цель на сегодня 12:00 МСК
		const target = new Date(mskNow)
		target.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0)

		// 3. Если сейчас уже больше 12:00, ставим цель на завтра
		if (mskNow >= target) {
			target.setDate(target.getDate() + 1)
		}

		// 4. Считаем разницу в мс
		const delay = target.getTime() - mskNow.getTime()

		const hours = Math.floor(delay / (1000 * 60 * 60))
		const minutes = Math.floor((delay % (1000 * 60 * 60)) / (1000 * 60))

		this.logger.log(
			`[ПЛАНИРОВЩИК] Следующий запуск: ${target.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`
		)
		this.logger.log(`[ПЛАНИРОВЩИК] Ожидание: ${hours}ч. ${minutes}мин.`)

		// 5. Запускаем таймер до первого выполнения
		setTimeout(async () => {
			await this.cron()

			// 6. После первого выполнения запускаем интервал 24 часа
			setInterval(
				async () => {
					await this.cron()
				},
				24 * 60 * 60 * 1000
			)

			this.logger.log(
				'[ПЛАНИРОВЩИК] Установлен ежедневный цикл (раз в 24 часа)'
			)
		}, delay)
	}

	public async cron() {
		await sleep(1000 * 120)

		this.logger.log('>>> Запуск синхронизации...')

		const sheets = await this.googleService.getAllSheets(
			this.configService.getOrThrow<string>('GOOGLE_FOLDER_ID')
		)

		if (sheets.length === 0) return

		this.logger.log('>>> Таблицы получены...')

		for (const sheet of sheets) {
			const settings = await this.googleService.getSheetSettings(sheet.id)

			if (settings.length === 0) continue

			this.logger.log('>>> Настроки для таблицы получены...')

			for (const settingsItem of settings) {
				await sleep(1000 * 120)

				if (
					settingsItem.auctionId === null ||
					settingsItem.arcId === null ||
					settingsItem.sku === null
				) {
					continue
				}

				this.logger.log('>>> Начинаю запрос данных с API WB...')
				this.logger.log('>>> Запрашиваю auctionFullstats...')

				const auctionFullstats = await this.wbService.getFullstats({
					ids: [settingsItem.auctionId]
				})

				await sleep(1000 * 120)

				this.logger.log('>>> Запрашиваю arcFullstats...')

				const arcFullstats = await this.wbService.getFullstats({
					ids: [settingsItem.arcId]
				})

				this.logger.log('>>> Запрашиваю funnelStats...')

				const funnelStats = await this.wbService.getFunnelStats(
					settingsItem.sku
				)

				this.logger.log('>>> Запрашиваю stocks...')

				const stocks = await this.wbService.getStocks(settingsItem.sku)

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
					settingsItem.sku,
					auctionFullstats,
					arcFullstats,
					funnelStats,
					stocks
				)
			}
		}
	}
}
