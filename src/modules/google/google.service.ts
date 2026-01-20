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
		try {
			const res = await this.sheets.spreadsheets.values.get({
				spreadsheetId,
				range: 'Статистика!B3:B5'
			})

			return res.data.values || []
		} catch (e) {
			this.logger.error(`Ошибка чтения таблицы ${spreadsheetId}`, e.stack)
			return []
		}
	}

	public async updateTable(
		spreadsheetId,
		auctionFullstats,
		arcFullstats,
		funnelStatsDay,
		stocks
	) {
		try {
			const SHEET_NAME = 'Статистика'
			const ROW_INDEX = 8

			const spreadsheet = await this.sheets.spreadsheets.get({
				spreadsheetId
			})

			const sheet = spreadsheet.data.sheets.find(
				s => s.properties.title === SHEET_NAME
			)

			const sheetId = sheet.properties.sheetId

			await this.sheets.spreadsheets.batchUpdate({
				spreadsheetId,
				requestBody: {
					requests: [
						{
							insertDimension: {
								range: {
									sheetId: sheetId,
									dimension: 'ROWS',
									startIndex: ROW_INDEX,
									endIndex: ROW_INDEX + 1
								},
								inheritFromBefore: false
							}
						}
					]
				}
			})

			const now = new Date()
			now.setDate(now.getDate() - 1)
			const formattedDate = now.toLocaleDateString('ru-RU', {
				day: '2-digit',
				month: '2-digit'
			})

			const rowData = [
				formattedDate,
				'',
				'',
				'',
				funnelStatsDay[0].history[0].orderSum,
				auctionFullstats[0].views,
				auctionFullstats[0].clicks,
				auctionFullstats[0].ctr,
				auctionFullstats[0].cpc,
				auctionFullstats[0].sum,
				arcFullstats[0].cpc,
				arcFullstats[0].sum,
				funnelStatsDay[0].history[0].openCount,
				funnelStatsDay[0].history[0].cartCount,
				funnelStatsDay[0].history[0].orderCount,
				'=T9*0,15',
				'',
				'',
				funnelStatsDay[0].history[0].orderCount === 0 ? '0' : '=E9/O9',
				stocks.data.items[0].metrics.stockCount
			]

			await this.sheets.spreadsheets.values.update({
				spreadsheetId,
				range: `${SHEET_NAME}!A${ROW_INDEX + 1}`,
				valueInputOption: 'USER_ENTERED',
				requestBody: {
					values: [rowData]
				}
			})

			this.logger.log(`>>> Обновление таблицы успешно завершено...`)
		} catch (e) {
			this.logger.error(`Ошибка при записи в 9-ю строку: ${e.message}`)
		}
	}
}
