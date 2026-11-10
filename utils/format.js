import { dateKey, parseDateKey } from './storage.js'

export function formatNumber(value) {
	const number = Math.round(Number(value) || 0)
	const sign = number < 0 ? '-' : ''
	return sign + String(Math.abs(number)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatSigned(value) {
	const number = Math.round(Number(value) || 0)
	if (!number) return '—'
	return `${number > 0 ? '+' : '-'}${formatNumber(Math.abs(number))}`
}

export function formatMonthDay(key) {
	const target = parseDateKey(key)
	if (!target) return ''
	return `${target.getMonth() + 1} 月 ${target.getDate()} 日`
}

export function formatDayLabel(key) {
	const target = parseDateKey(key)
	if (!target) return ''
	const today = new Date()
	if (key === dateKey(today)) return '今天'
	const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
	if (key === dateKey(yesterday)) return '昨天'
	return formatMonthDay(key)
}

export function formatTime(timestamp) {
	const date = new Date(Number(timestamp) || Date.now())
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function formatRecordTime(record) {
	if (!record) return ''
	return `${formatDayLabel(record.date)} · ${formatTime(record.createdAt)}`
}
