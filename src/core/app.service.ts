import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
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
		// this.cron()
		// this.scheduleDailySync()
		this.historySync()
	}

	private scheduleDailySync() {
		const TARGET_HOUR = 11
		const TARGET_MINUTE = 0

		const now = new Date()
		const mskNow = new Date(
			now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' })
		)

		const target = new Date(mskNow)
		target.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0)

		if (mskNow >= target) {
			target.setDate(target.getDate() + 1)
		}

		const delay = target.getTime() - mskNow.getTime()

		const hours = Math.floor(delay / (1000 * 60 * 60))
		const minutes = Math.floor((delay % (1000 * 60 * 60)) / (1000 * 60))

		this.logger.log(
			`[ПЛАНИРОВЩИК] Следующий запуск: ${target.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`
		)
		this.logger.log(`[ПЛАНИРОВЩИК] Ожидание: ${hours}ч. ${minutes}мин.`)

		setTimeout(async () => {
			// await this.cron()

			setInterval(
				async () => {
					// await this.cron()
				},
				24 * 60 * 60 * 1000
			)

			this.logger.log(
				'[ПЛАНИРОВЩИК] Установлен ежедневный цикл (раз в 24 часа)'
			)
		}, delay)
	}

	// public async cron() {
	// 	await sleep(1000 * 100)

	// 	this.logger.log('>>> Запуск синхронизации...')

	// 	const sheets = await this.googleService.getAllSheets(
	// 		this.configService.getOrThrow<string>('GOOGLE_FOLDER_ID')
	// 	)

	// 	if (sheets.length === 0) return

	// 	this.logger.log('>>> Таблицы получены...')

	// 	for (const sheet of sheets) {
	// 		const settings = await this.googleService.getSheetSettings(sheet.id)

	// 		if (settings.length === 0) continue

	// 		this.logger.log('>>> Настроки для таблицы получены...')

	// 		for (const settingsItem of settings) {
	// 			await sleep(1000 * 100)

	// 			if (
	// 				settingsItem.auctionId === null ||
	// 				settingsItem.arcId === null ||
	// 				settingsItem.sku === null
	// 			) {
	// 				continue
	// 			}

	// 			this.logger.log('>>> Начинаю запрос данных с API WB...')
	// 			this.logger.log('>>> Запрашиваю auctionFullstats...')

	// 			const auctionFullstats = await this.wbService.getFullstats({
	// 				ids: [settingsItem.auctionId]
	// 			})

	// 			await sleep(1000 * 100)

	// 			this.logger.log('>>> Запрашиваю arcFullstats...')

	// 			const arcFullstats = await this.wbService.getFullstats({
	// 				ids: [settingsItem.arcId]
	// 			})

	// 			this.logger.log('>>> Запрашиваю funnelStats...')

	// 			const funnelStats = await this.wbService.getFunnelStats(
	// 				settingsItem.sku
	// 			)

	// 			this.logger.log('>>> Запрашиваю stocks...')

	// 			const stocks = await this.wbService.getStocks(settingsItem.sku)

	// 			if (
	// 				auctionFullstats === null ||
	// 				arcFullstats === null ||
	// 				funnelStats === null ||
	// 				stocks === null
	// 			) {
	// 				continue
	// 			}

	// 			this.logger.log('>>> Данные с API WB успешно получены...')
	// 			this.logger.log('>>> Начинаю обновление таблицы...')

	// 			await this.googleService.updateTable(
	// 				sheet.id,
	// 				settingsItem.sku,
	// 				auctionFullstats,
	// 				arcFullstats,
	// 				funnelStats,
	// 				stocks
	// 			)
	// 		}
	// 	}
	// }

	public async historySync() {
		this.logger.log('>>> Запуск синхронизации...')

		const sheets = await this.googleService.getAllSheets(
			this.configService.getOrThrow<string>('GOOGLE_FOLDER_ID')
		)

		if (sheets.length === 0) return

		this.logger.log('>>> Таблицы получены...')

		for (const sheet of sheets) {
			const settings = await this.googleService.getSheetSettings(sheet.id)

			if (settings.settings.length === 0) continue

			this.logger.log('>>> Настроки для таблицы получены...')

			for (const settingsItem of settings.settings) {
				await sleep(1000 * 100)

				if (!settings.token) {
					continue
				}
				if (settingsItem.sku === null) {
					continue
				}

				this.logger.log('>>> Начинаю запрос данных с API WB...')
				this.logger.log('>>> Запрашиваю auctionFullstats...')

				const datesArr = ['2026-02-02']

				for (const date of datesArr.reverse()) {
					await sleep(1000 * 100)

					const auctionFullstats = settingsItem.auctionId
						? await this.wbService.getFullstats({
								ids: [settingsItem.auctionId],
								date,
								token: settings.token
							})
						: null

					console.log(auctionFullstats)

					await sleep(1000 * 100)

					this.logger.log('>>> Запрашиваю arcFullstats...')

					const arcFullstats = settingsItem.arcId
						? await this.wbService.getFullstats({
								ids: [settingsItem.arcId],
								date,
								token: settings.token
							})
						: null

					this.logger.log('>>> Запрашиваю funnelStats...')

					console.log(arcFullstats)

					const funnelStats = await this.wbService.getFunnelStats(
						settingsItem.sku,
						settings.token,
						date
					)

					this.logger.log('>>> Запрашиваю stocks...')

					console.log(funnelStats)

					const stocks = await this.wbService.getStocks(
						settingsItem.sku,
						settings.token
					)

					console.log(stocks)

					if (funnelStats === null || stocks === null) {
						continue
					}

					this.logger.log('>>> Данные с API WB успешно получены...')
					this.logger.log('>>> Начинаю обновление таблицы...')

					await this.googleService.updateTable(
						sheet.id,
						settingsItem.auctionId,
						settingsItem.arcId,
						settingsItem.sku,
						auctionFullstats,
						arcFullstats,
						funnelStats,
						stocks,
						date
					)
				}
			}
		}
	}
}
