import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { google } from 'googleapis'
import * as path from 'path'

@Injectable()
export class GoogleService {
	private readonly logger = new Logger(GoogleService.name)
	private drive
	private sheets

	public constructor(private readonly configService: ConfigService) {
		let auth

		if (this.configService.getOrThrow('NODE_ENV') === 'development') {
			auth = new google.auth.GoogleAuth({
				keyFile: path.join(process.cwd(), 'google-credentials.json'),
				scopes: [
					'https://www.googleapis.com/auth/drive',
					'https://www.googleapis.com/auth/spreadsheets'
				]
			})
		} else {
			auth = new google.auth.GoogleAuth({
				credentials: JSON.parse(
					this.configService.getOrThrow('GOOGLE_AUTH_JSON')
				),
				scopes: [
					'https://www.googleapis.com/auth/drive',
					'https://www.googleapis.com/auth/spreadsheets'
				]
			})
		}

		this.drive = google.drive({ version: 'v3', auth })
		this.sheets = google.sheets({ version: 'v4', auth })
	}

	public async getAllSheets(folderId: string) {
		try {
			const response = await this.drive.files.list({
				q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
				fields: 'files(id, name)'
			})

			return response.data.files || []
		} catch (e) {
			this.logger.error('Ошибка при вызове drive.files.list:', e.message)
			return []
		}
	}

	public async getSheetSettings(spreadsheetId: string) {
		const res = await this.sheets.spreadsheets.values.batchGet({
			spreadsheetId,
			ranges: ['Статистика!B6:B6', 'Статистика!B3:5']
		})

		const valueRanges = res.data.valueRanges
		const wbToken = valueRanges[0].values
			? valueRanges[0].values[0][0]
			: null
		const rows = valueRanges[1].values

		if (!wbToken) {
			this.logger.error(
				`В таблице ${spreadsheetId} не найден WB Token в ячейке B6`
			)
		}

		if (!rows || rows.length < 3) return { wbToken, settings: [] }

		const auctionRow = rows[0] || []
		const arcRow = rows[1] || []
		const skuRow = rows[2] || []

		const settings: any = []
		const maxLength = Math.max(
			auctionRow.length,
			arcRow.length,
			skuRow.length
		)

		for (let i = 0; i < maxLength; i++) {
			if (skuRow[i]) {
				settings.push({
					auctionId:
						auctionRow[i] === '' || !auctionRow[i]
							? null
							: String(auctionRow[i]).trim(),
					arcId:
						arcRow[i] === '' || !arcRow[i]
							? null
							: String(arcRow[i]).trim(),
					sku: String(skuRow[i]).trim()
				})
			}
		}

		return { settings, token: wbToken }
	}

	public async updateTable(
		spreadsheetId,
		auctionId,
		arcId,
		sku,
		auctionFullstats,
		arcFullstats,
		funnelStatsDay,
		stocks,
		date?: string
	) {
		try {
			const SHEET_NAME = 'Статистика'

			const res = await this.sheets.spreadsheets.values.get({
				spreadsheetId,
				range: `${SHEET_NAME}!A:A`
			})
			const colA = res.data.values?.map(row => row[0]) || []

			let skuRowIndex = colA.indexOf(
				String(
					`${sku} ${auctionId ? auctionId : ''} ${arcId ? arcId : ''}`
				)
			)

			if (skuRowIndex === -1) {
				const lastRow = colA.length + 1

				await this.createNewSkuBlock(
					spreadsheetId,
					lastRow + 1,
					`${sku} ${auctionId ? auctionId : ''} ${arcId ? arcId : ''}`
				)

				await this.insertDataRow(
					spreadsheetId,
					lastRow + 4,
					auctionFullstats,
					arcFullstats,
					funnelStatsDay,
					stocks,
					date
				)
			} else {
				const targetRow = skuRowIndex + 4
				await this.insertDataRow(
					spreadsheetId,
					targetRow,
					auctionFullstats,
					arcFullstats,
					funnelStatsDay,
					stocks,
					date
				)
			}

			this.logger.log(`>>> Обновление таблицы успешно завершено...`)
		} catch (e) {
			this.logger.error(`Ошибка при записи в 9-ю строку: ${e.message}`)
		}
	}

	private async insertDataRow(
		spreadsheetId: string,
		rowIndex: number,
		auctionFullstats,
		arcFullstats,
		funnelStatsDay,
		stocks,
		date?: string
	) {
		const SHEET_NAME = 'Статистика'

		// Получаем sheetId
		const spreadsheet = await this.sheets.spreadsheets.get({
			spreadsheetId
		})
		const sheetId = spreadsheet.data.sheets.find(
			s => s.properties.title === SHEET_NAME
		).properties.sheetId

		// 1. Раздвигаем таблицу
		await this.sheets.spreadsheets.batchUpdate({
			spreadsheetId,
			requestBody: {
				requests: [
					{
						insertDimension: {
							range: {
								sheetId,
								dimension: 'ROWS',
								startIndex: rowIndex - 1,
								endIndex: rowIndex
							},
							inheritFromBefore: false
						}
					}
				]
			}
		})

		// 2. Пишем данные
		const rowData = [
			date ? date : this.getYesterdayDate(),
			'',
			'',
			'',
			funnelStatsDay[0].history[0].orderSum,
			auctionFullstats !== null ? auctionFullstats[0].views : '',
			auctionFullstats !== null ? auctionFullstats[0].clicks : '',
			auctionFullstats !== null ? auctionFullstats[0].ctr : '',
			auctionFullstats !== null ? auctionFullstats[0].cpc : '',
			auctionFullstats !== null ? auctionFullstats[0].sum : '',
			arcFullstats !== null ? arcFullstats[0].cpc : '',
			arcFullstats !== null ? arcFullstats[0].sum : '',
			funnelStatsDay[0].history[0].openCount,
			funnelStatsDay[0].history[0].cartCount,
			funnelStatsDay[0].history[0].orderCount,
			`=T${rowIndex}*0,15`,
			'',
			'',
			funnelStatsDay[0].history[0].orderCount === 0
				? '0'
				: `=E${rowIndex}/O${rowIndex}`,
			stocks.data.items[0].metrics.stockCount
		]

		await this.sheets.spreadsheets.values.update({
			spreadsheetId,
			range: `${SHEET_NAME}!A${rowIndex}`,
			valueInputOption: 'USER_ENTERED',
			requestBody: { values: [rowData] }
		})
	}

	private async createNewSkuBlock(
		spreadsheetId: string,
		startRow: number,
		sku: string
	) {
		const SHEET_NAME = 'Статистика'
		const spreadsheet = await this.sheets.spreadsheets.get({
			spreadsheetId
		})
		const sheetId = spreadsheet.data.sheets.find(
			s => s.properties.title === SHEET_NAME
		).properties.sheetId

		// 1. Записываем сам SKU в первую колонку новой строки
		await this.sheets.spreadsheets.values.update({
			spreadsheetId,
			range: `${SHEET_NAME}!A${startRow}`,
			valueInputOption: 'RAW',
			requestBody: { values: [[sku]] }
		})

		// 2. Копируем строки 7 и 8 (оформление) и вставляем их под SKU
		await this.sheets.spreadsheets.batchUpdate({
			spreadsheetId,
			requestBody: {
				requests: [
					{
						copyPaste: {
							source: {
								sheetId,
								startRowIndex: 7, // 8 строка
								endRowIndex: 9, // до 9 включительно
								startColumnIndex: 0,
								endColumnIndex: 20
							},
							destination: {
								sheetId,
								startRowIndex: startRow, // сразу под SKU
								endRowIndex: startRow + 2,
								startColumnIndex: 0,
								endColumnIndex: 20
							},
							pasteType: 'PASTE_NORMAL'
						}
					}
				]
			}
		})
	}

	private getYesterdayDate() {
		const mskNow = new Date(
			new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' })
		)

		mskNow.setDate(mskNow.getDate() - 1)

		const month = String(mskNow.getMonth() + 1).padStart(2, '0')
		const day = String(mskNow.getDate()).padStart(2, '0')

		return `${day}.${month}`
	}
}
