import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

@Injectable()
export class WbService {
	public constructor(private readonly configService: ConfigService) {}

	public async getFullstats(data) {
		const { ids, date, token } = data

		try {
			const url = 'https://advert-api.wildberries.ru/adv/v3/fullstats'

			const response = await axios.get(url, {
				params: {
					ids: ids.join(','),
					beginDate: date ? date : this.getYesterdayDate(),
					endDate: date ? date : this.getYesterdayDate()
				},
				headers: {
					Authorization: token
				}
			})

			if (!response.data) return null

			return response.data
		} catch (e) {
			return null
		}
	}

	public async getFunnelStats(nmId: string, token: string, date?: string) {
		try {
			const url =
				'https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products/history'

			const response = await axios.post(
				url,
				{
					nmIds: [Number(nmId)],
					selectedPeriod: {
						start: date ? date : this.getYesterdayDate(),
						end: date ? date : this.getYesterdayDate()
					}
				},
				{
					headers: {
						Authorization: token,
						'Content-Type': 'application/json'
					}
				}
			)

			if (!response.data) return null

			return response.data
		} catch (e) {
			return null
		}
	}

	public async getStocks(nmId: string, token) {
		try {
			const yesterdayDate = this.getYesterdayDate()

			const url =
				'https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/products'

			const response = await axios.post(
				url,
				{
					nmIDs: [Number(nmId)],
					currentPeriod: {
						start: yesterdayDate,
						end: yesterdayDate
					},
					stockType: 'wb',
					skipDeletedNm: false,
					orderBy: {
						field: 'avgOrders',
						mode: 'asc'
					},
					availabilityFilters: [
						'deficient',
						'actual',
						'balanced',
						'nonActual',
						'nonLiquid',
						'invalidData'
					],
					offset: 0
				},
				{
					headers: {
						Authorization: token,
						'Content-Type': 'application/json'
					}
				}
			)

			if (!response.data) return null

			return response.data
		} catch (e) {
			return null
		}
	}

	private getYesterdayDate() {
		const mskNow = new Date(
			new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' })
		)

		mskNow.setDate(mskNow.getDate() - 1)

		const year = mskNow.getFullYear()
		const month = String(mskNow.getMonth() + 1).padStart(2, '0')
		const day = String(mskNow.getDate()).padStart(2, '0')

		return `${year}-${month}-${day}`
	}
}
