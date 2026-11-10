const STORAGE_KEY = 'efootball_coins_data_v1'
const DAY_MS = 86400000
const VERSION = 2

function pad(value) {
	return String(value).padStart(2, '0')
}

function toInteger(value) {
	const number = Number(value)
	return Number.isFinite(number) ? Math.round(number) : 0
}

function startOfDay(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function dateKey(date) {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatDateKey(date) {
	return dateKey(date)
}

export function parseDateKey(key) {
	const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(key || ''))
	if (!match) return null
	return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function normalizeDateKey(value, fallbackTimestamp) {
	const parsed = parseDateKey(value)
	if (parsed) return dateKey(parsed)
	return dateKey(new Date(Number(fallbackTimestamp) || Date.now()))
}

/* ---------- 记录模型：一条记录 = 某一天的「账户金币总额」快照 ---------- */

function normalizeRecord(record, index) {
	const source = record && typeof record === 'object' ? record : {}
	const createdAt = Number(source.createdAt) || Date.now() - index
	const date = normalizeDateKey(source.date, createdAt)
	return {
		id: source.id || `record-${date}`,
		date,
		balance: toInteger(source.balance),
		note: source.note || '',
		createdAt
	}
}

// 同一天只保留最后一条快照，并按日期倒序排好
function normalizeRecords(list) {
	const byDate = {}
	;(Array.isArray(list) ? list : []).map(normalizeRecord).forEach(record => {
		const previous = byDate[record.date]
		if (!previous || previous.createdAt <= record.createdAt) byDate[record.date] = record
	})
	return Object.keys(byDate)
		.map(key => byDate[key])
		.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : (a.date < b.date ? 1 : -1)))
}

// 旧版是「收支流水」，按时间顺序累积成余额，再把同一天的合并成一条快照
function migrateLegacy(data) {
	const startingCoins = toInteger(data.startingCoins)
	const list = Array.isArray(data.records) ? data.records.slice() : []
	list.sort((a, b) => Number(a && a.createdAt || 0) - Number(b && b.createdAt || 0))
	let running = startingCoins
	const byDate = {}
	list.forEach(record => {
		if (!record) return
		const amount = Math.abs(toInteger(record.amount))
		running += record.type === 'spend' ? -amount : amount
		const createdAt = Number(record.createdAt) || Date.now()
		const date = normalizeDateKey(record.date, createdAt)
		byDate[date] = {
			id: `record-${date}`,
			date,
			balance: running,
			note: record.note || '',
			createdAt
		}
	})
	return {
		version: VERSION,
		startingCoins,
		goal: data.goal,
		records: Object.keys(byDate).map(key => byDate[key]),
		settings: data.settings
	}
}

function looksLegacy(data) {
	if (!data || !Array.isArray(data.records)) return false
	return data.records.some(record => record && record.balance === undefined && (record.amount !== undefined || record.type !== undefined))
}

function normalize(data) {
	const raw = data && typeof data === 'object' ? data : {}
	const source = looksLegacy(raw) ? migrateLegacy(raw) : raw
	const goal = source.goal && typeof source.goal === 'object' ? source.goal : {}
	return {
		version: VERSION,
		startingCoins: toInteger(source.startingCoins),
		goal: {
			name: goal.name || '未命名目标',
			targetCoins: Math.max(toInteger(goal.targetCoins), 0),
			targetDate: normalizeDateKey(goal.targetDate, Date.now())
		},
		records: normalizeRecords(source.records),
		settings: Object.assign({ reminder: true }, source.settings || {})
	}
}

export function createDefaultData() {
	const today = new Date()
	const yesterday = new Date(today.getTime() - DAY_MS)
	return normalize({
		startingCoins: 2520,
		goal: { name: '冬季精选抽卡', targetCoins: 4000, targetDate: `${today.getFullYear()}-12-20` },
		records: [
			{ id: 'seed-yesterday', date: dateKey(yesterday), balance: 2670, note: '', createdAt: yesterday.getTime() },
			{ id: 'seed-today', date: dateKey(today), balance: 2750, note: '', createdAt: today.getTime() }
		],
		settings: { reminder: true }
	})
}

export function getData() {
	let saved = null
	try {
		saved = uni.getStorageSync(STORAGE_KEY)
	} catch (error) {
		console.error('[storage] 读取失败', error)
	}
	if (!saved || typeof saved !== 'object' || !Array.isArray(saved.records)) {
		const initial = createDefaultData()
		try {
			uni.setStorageSync(STORAGE_KEY, initial)
		} catch (error) {
			console.error('[storage] 初始化写入失败', error)
		}
		return initial
	}
	const normalized = normalize(saved)
	// 旧结构读出来就地升级，避免每次打开都重新迁移；升级失败不影响本次使用
	if (saved.version !== VERSION || looksLegacy(saved)) {
		try {
			uni.setStorageSync(STORAGE_KEY, normalized)
		} catch (error) {
			console.error('[storage] 升级写入失败', error)
		}
	}
	return normalized
}

// 写盘失败（配额超限、环境异常）时返回 null，由调用方决定怎么提示
export function saveData(data) {
	const normalized = normalize(data)
	try {
		uni.setStorageSync(STORAGE_KEY, normalized)
	} catch (error) {
		console.error('[storage] 写入失败', error)
		return null
	}
	return normalized
}

export function saveGoal(data, patch) {
	const target = data && Array.isArray(data.records) ? data : getData()
	target.goal = Object.assign({}, target.goal, patch || {})
	if (!saveData(target)) return null
	return getData()
}

export function saveSettings(data, patch) {
	const target = data && Array.isArray(data.records) ? data : getData()
	target.settings = Object.assign({}, target.settings, patch || {})
	if (!saveData(target)) return null
	return getData()
}

export function setStartingCoins(data, value) {
	const target = data && Array.isArray(data.records) ? data : getData()
	target.startingCoins = toInteger(value)
	if (!saveData(target)) return null
	return getData()
}

/* ---------- 读取 ---------- */

// untilKey：只看不晚于该日期的记录；用于「当前金币」排除误录的未来快照
export function getLatestRecord(data, untilKey) {
	if (!data || !Array.isArray(data.records) || !data.records.length) return null
	const limit = untilKey ? normalizeDateKey(untilKey, Date.now()) : ''
	return data.records.reduce((latest, record) => {
		if (limit && record.date > limit) return latest
		if (!latest) return record
		if (record.date > latest.date) return record
		if (record.date === latest.date && record.createdAt > latest.createdAt) return record
		return latest
	}, null)
}

export function getCurrentCoins(data) {
	const latest = getLatestRecord(data, dateKey(new Date()))
	return latest ? latest.balance : toInteger(data && data.startingCoins)
}

export function getRecordOn(data, key) {
	if (!data || !Array.isArray(data.records)) return null
	const target = normalizeDateKey(key, Date.now())
	return data.records.find(record => record.date === target) || null
}

// 某天之前最近一次余额；没有历史记录时回落到初始金币
export function getBaseline(data, key) {
	const target = normalizeDateKey(key, Date.now())
	let latest = null
	if (data && Array.isArray(data.records)) {
		data.records.forEach(record => {
			if (record.date < target && (!latest || record.date > latest.date)) latest = record
		})
	}
	if (latest) return { balance: latest.balance, date: latest.date }
	return { balance: toInteger(data && data.startingCoins), date: null }
}

// 某天的变化 = 当天快照 - 之前最近一次余额；当天没记录返回 null
export function getChangeOn(data, key) {
	const record = getRecordOn(data, key)
	if (!record) return null
	return record.balance - getBaseline(data, key).balance
}

export function getNetBetween(data, startKey, endKey) {
	const start = normalizeDateKey(startKey, Date.now())
	const end = normalizeDateKey(endKey, Date.now())
	const base = getBaseline(data, start).balance
	let last = null
	if (data && Array.isArray(data.records)) {
		data.records.forEach(record => {
			if (record.date <= end && (!last || record.date > last.date)) last = record
		})
	}
	return (last ? last.balance : base) - base
}

// 逐日索引：按日期正序累计出每天的余额、当天变化、以及当天之前的基线
// 日历页（格子+编辑区）、统计页（每日增量）、历史页（每行增量）共用这一份
export function getDayIndex(data) {
	const records = data && Array.isArray(data.records) ? data.records.slice() : []
	const index = {}
	let previous = toInteger(data && data.startingCoins)
	records
		.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : (a.date < b.date ? -1 : 1)))
		.forEach(record => {
			index[record.date] = {
				balance: record.balance,
				change: record.balance - previous,
				baseline: previous
			}
			previous = record.balance
		})
	return index
}

/* ---------- 写入 ---------- */

// 写入某一天的账户总额；已存在则覆盖。日期晚于今天或写盘失败时返回 null
export function upsertDayBalance(data, key, balance, note) {
	const target = data && Array.isArray(data.records) ? data : getData()
	const date = normalizeDateKey(key, Date.now())
	if (date > dateKey(new Date())) return null
	const existing = target.records.find(record => record.date === date)
	if (existing) {
		existing.balance = toInteger(balance)
		existing.createdAt = Date.now()
		if (note !== undefined) existing.note = note
	} else {
		target.records.unshift({
			id: `record-${date}`,
			date,
			balance: toInteger(balance),
			note: note || '',
			createdAt: Date.now()
		})
	}
	if (!saveData(target)) return null
	return getData()
}

export function removeRecord(data, id) {
	const target = data && Array.isArray(data.records) ? data : getData()
	target.records = target.records.filter(record => record.id !== id)
	if (!saveData(target)) return null
	return getData()
}

export function removeRecordOn(data, key) {
	const record = getRecordOn(data, key)
	if (!record) return getData()
	return removeRecord(data, record.id)
}

/* ---------- 由快照派生的指标 ---------- */

export function getGoalRemaining(data) {
	const target = data && data.goal ? toInteger(data.goal.targetCoins) : 0
	return Math.max(target - getCurrentCoins(data), 0)
}

export function getGoalProgress(data) {
	const target = data && data.goal ? toInteger(data.goal.targetCoins) : 0
	if (!target) return 0
	return Math.min(Math.max(Math.round(getCurrentCoins(data) / target * 100), 0), 100)
}

export function getDaysLeft(targetKey, from = new Date()) {
	const target = parseDateKey(targetKey)
	if (!target) return 0
	return Math.max(Math.ceil((target - startOfDay(from)) / DAY_MS), 0)
}

// 剩余金币按剩余天数均摊、向上取整；没有剩余天数时返回剩余总额
export function computeDailyNeed(remaining, days) {
	const left = Math.max(toInteger(remaining), 0)
	if (left <= 0) return 0
	if (!days || days <= 0) return left
	return Math.ceil(left / days)
}

export function getDailyNeed(data, from = new Date()) {
	const remaining = getGoalRemaining(data)
	const days = getDaysLeft(data && data.goal ? data.goal.targetDate : '', from)
	return computeDailyNeed(remaining, days)
}

// 滚动窗口净增长：从 from 往前数 days 天（含 from 当天）
// 首页「近 7 天增长」和统计「最近 7 天」都走这里，保证两处数字完全一致
export function getRollingNet(data, days = 7, from = new Date()) {
	const end = startOfDay(from)
	const start = new Date(end)
	start.setDate(start.getDate() - (Math.max(days, 1) - 1))
	return getNetBetween(data, dateKey(start), dateKey(end))
}

export function getMonthNet(data, from = new Date()) {
	const start = new Date(from.getFullYear(), from.getMonth(), 1)
	const end = new Date(from.getFullYear(), from.getMonth() + 1, 0)
	return getNetBetween(data, dateKey(start), dateKey(end))
}

export function getRecordsInMonth(data, from = new Date()) {
	if (!data || !Array.isArray(data.records)) return []
	const prefix = `${from.getFullYear()}-${pad(from.getMonth() + 1)}`
	return data.records.filter(record => record.date.slice(0, 7) === prefix)
}
