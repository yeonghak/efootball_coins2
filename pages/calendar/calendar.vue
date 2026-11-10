<template>
	<view class="page">
		<view class="content content--tab">
			<view class="intro">
				<text class="title">{{ monthTitle }}金币日历</text>
				<text class="subtitle">本月增长 {{ monthNetText }} · 格子显示当天余额，点击可修改</text>
			</view>
			<view class="card">
				<view class="month">
					<text class="month-button" @tap="changeMonth(-1)">‹</text>
					<text class="month-title">{{ monthTitle }}</text>
					<text class="month-button" @tap="changeMonth(1)">›</text>
				</view>
				<view class="week"><text v-for="week in weeks" :key="week">{{ week }}</text></view>
				<view class="calendar">
					<view v-for="(day, index) in calendarDays" :key="index" class="day" :class="{ blank: !day.date, selected: day.key === selectedKey, empty: !day.hasRecord, today: day.key === todayKey, future: day.future }" @tap="day.date && selectDay(day)">
						<text v-if="day.date" class="date">{{ day.date }}</text>
						<text v-if="day.date" class="value" :class="{ tight: day.tight }">{{ day.balanceText }}</text>
					</view>
				</view>
			</view>
			<view class="card edit" id="edit-card">
				<view class="edit-header">
					<text class="edit-title">{{ selectedLabel }}</text>
					<text :class="deltaClass">{{ deltaText }}</text>
				</view>
				<text class="label">当天账户金币总额</text>
				<input v-model.number="draftBalance" class="input amount-input" type="number" placeholder="例如 2750" :focus="autoFocus" @input="onAmountInput" @focus="saved = ''" @blur="autoFocus = false"/>
				<text v-if="baselineText" class="hint">{{ baselineText }}</text>
				<text class="label">备注（可选）</text>
				<input v-model="draftNote" class="input" placeholder="例如：打完联赛后结算" @focus="saved = ''"/>
				<button class="primary" @tap="save">{{ saveLabel }}</button>
				<text v-if="saved" class="saved">{{ saved }}</text>
				<text v-if="selectedHasRecord" class="delete-link" @tap="confirmDelete">删除这天记录</text>
			</view>
		</view>
		<app-tabbar active="calendar"/>
	</view>
</template>

<script>
import AppTabbar from '@/components/AppTabbar.vue'
import { getData, getDayIndex, upsertDayBalance, removeRecordOn, formatDateKey, parseDateKey } from '@/utils/storage'
import { formatNumber, formatSigned, formatMonthDay, formatDayLabel } from '@/utils/format'

export default {
	components: { AppTabbar },
	data() {
		const today = new Date()
		return {
			weeks: ['一', '二', '三', '四', '五', '六', '日'],
			currentYear: today.getFullYear(),
			currentMonth: today.getMonth(),
			records: [],
			startingCoins: 0,
			todayKey: formatDateKey(today),
			selectedKey: formatDateKey(today),
			draftBalance: 0,
			draftNote: '',
			// 用户是否动过金额输入框：没动过时按钮文案会标明「记为持平」，不再作为拦截依据
			draftDirty: false,
			autoFocus: false,
			focusOnShow: false,
			saved: ''
		}
	},
	computed: {
		monthTitle() {
			return `${this.currentYear} 年 ${this.currentMonth + 1} 月`
		},
		monthPrefix() {
			return formatDateKey(new Date(this.currentYear, this.currentMonth, 1)).slice(0, 7)
		},
		// 逐日索引统一由数据层计算，日历格子、编辑区基线、统计、历史共用
		dayIndex() {
			return getDayIndex({ records: this.records, startingCoins: this.startingCoins })
		},
		calendarDays() {
			const first = new Date(this.currentYear, this.currentMonth, 1)
			const lead = (first.getDay() + 6) % 7
			const total = new Date(this.currentYear, this.currentMonth + 1, 0).getDate()
			const blanks = Array.from({ length: lead }, () => ({}))
			const days = Array.from({ length: total }, (_, i) => {
				const date = i + 1
				const key = formatDateKey(new Date(this.currentYear, this.currentMonth, date))
				const entry = this.dayIndex[key]
				const balanceText = entry ? formatNumber(entry.balance) : '—'
				return {
					date,
					key,
					hasRecord: !!entry,
					balanceText,
					future: key > this.todayKey,
					// 6 位以内（如 123,456）按 20rpx 刚好放得下，再长才缩到 16rpx
					tight: balanceText.length > 7
				}
			})
			const tail = (7 - (blanks.length + days.length) % 7) % 7
			return blanks.concat(days, Array.from({ length: tail }, () => ({})))
		},
		monthNet() {
			return this.records
				.filter(record => record.date.slice(0, 7) === this.monthPrefix)
				.reduce((total, record) => total + (this.dayIndex[record.date] ? this.dayIndex[record.date].change : 0), 0)
		},
		monthNetText() { return formatSigned(this.monthNet) },
		selectedLabel() { return formatMonthDay(this.selectedKey) },
		selectedEntry() { return this.dayIndex[this.selectedKey] || null },
		selectedHasRecord() { return !!this.selectedEntry },
		selectedBaseline() {
			if (this.selectedEntry) return this.selectedEntry.baseline
			let latest = null
			this.records.forEach(record => {
				if (record.date < this.selectedKey && (!latest || record.date > latest.date)) latest = record
			})
			return latest ? latest.balance : this.startingCoins
		},
		baselineText() {
			let latest = null
			this.records.forEach(record => {
				if (record.date < this.selectedKey && (!latest || record.date > latest.date)) latest = record
			})
			const label = latest ? formatDayLabel(latest.date) : '初始金币'
			return `上次 ${label} · ${formatNumber(this.selectedBaseline)}`
		},
		draftDelta() {
			const value = Math.round(Number(this.draftBalance) || 0)
			return value - this.selectedBaseline
		},
		deltaText() {
			if (this.draftBalance === '' || this.draftBalance === null) return '填写后显示相比上次的变化'
			if (this.draftDelta === 0) return '持平'
			return formatSigned(this.draftDelta)
		},
		deltaClass() {
			if (this.draftBalance === '' || this.draftBalance === null) return 'flat'
			if (this.draftDelta === 0) return 'flat'
			return this.draftDelta > 0 ? 'gain' : 'spend'
		},
		// 空白日且没动过输入框时，预填值就是上次余额，直接保存等于「这天与上次持平」
		// 补录持平时用户本就不该改这个数，所以不拦，而是把后果写在按钮上
		saveLabel() {
			if (this.selectedHasRecord) return '保存修改'
			if (!this.draftDirty) return `记为持平 ${formatNumber(this.selectedBaseline)}`
			return '保存记录'
		}
	},
	onLoad(options) {
		const opts = options || {}
		// 从首页「记录一笔金币」进来时带 focus=1，直接聚焦输入框
		this.focusOnShow = String(opts.focus) === '1'
		// 从历史页点某条记录进来时带 date=YYYY-MM-DD，定位到那天
		const target = parseDateKey(opts.date || '')
		if (!target) return
		const key = formatDateKey(target)
		if (key > this.todayKey) {
			uni.showToast({ title: '还不能查看未来日期', icon: 'none' })
			return
		}
		this.currentYear = target.getFullYear()
		this.currentMonth = target.getMonth()
		this.selectedKey = key
	},
	onShow() {
		this.load()
		this.autoFocus = this.focusOnShow
		this.focusOnShow = false
	},
	methods: {
		load() {
			const data = getData()
			this.todayKey = formatDateKey(new Date())
			this.records = data.records
			this.startingCoins = data.startingCoins
			const entry = this.dayIndex[this.selectedKey]
			const record = this.records.find(item => item.date === this.selectedKey)
			const baseline = this.selectedBaseline
			this.draftBalance = entry ? entry.balance : baseline
			this.draftNote = record ? record.note : ''
			this.draftDirty = false
			this.saved = ''
		},
		selectDay(day) {
			if (day.future) {
				uni.showToast({ title: '还不能记录未来日期', icon: 'none' })
				return
			}
			this.selectedKey = day.key
			const entry = this.dayIndex[day.key]
			const record = this.records.find(item => item.date === day.key)
			this.draftBalance = entry ? entry.balance : this.selectedBaseline
			this.draftNote = record ? record.note : ''
			this.draftDirty = false
			this.saved = ''
		},
		changeMonth(step) {
			let month = this.currentMonth + step
			let year = this.currentYear
			if (month < 0) { month = 11; year -= 1 }
			if (month > 11) { month = 0; year += 1 }
			const now = new Date()
			if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth())) {
				uni.showToast({ title: '不能查看未来月份', icon: 'none' })
				return
			}
			this.currentYear = year
			this.currentMonth = month
			const isThisMonth = year === now.getFullYear() && month === now.getMonth()
			this.selectedKey = formatDateKey(new Date(year, month, isThisMonth ? now.getDate() : 1))
			this.load()
		},
		onAmountInput() {
			this.draftDirty = true
		},
		save() {
			if (this.draftBalance === '' || this.draftBalance === null || this.draftBalance === undefined) {
				uni.showToast({ title: '请输入当天账户总额', icon: 'none' })
				return
			}
			const balance = Math.round(Number(this.draftBalance))
			if (!Number.isFinite(balance) || balance < 0) {
				uni.showToast({ title: '金币总额不能为负数', icon: 'none' })
				return
			}
			if (this.selectedKey > this.todayKey) {
				uni.showToast({ title: '还不能记录未来日期', icon: 'none' })
				return
			}
			const result = upsertDayBalance(getData(), this.selectedKey, balance, String(this.draftNote || '').trim())
			if (!result) {
				uni.showToast({ title: '保存失败，请重试', icon: 'none' })
				return
			}
			this.load()
			this.saved = `已保存 ${this.selectedLabel} · ${formatNumber(balance)} 金币`
		},
		confirmDelete() {
			uni.showModal({
				title: '删除这天记录？',
				content: `${this.selectedLabel} · ${formatNumber(this.selectedEntry.balance)} 金币`,
				confirmText: '删除',
				confirmColor: '#b56016',
				success: res => {
					if (!res.confirm) return
					const result = removeRecordOn(getData(), this.selectedKey)
					if (!result) {
						uni.showToast({ title: '删除失败，请重试', icon: 'none' })
						return
					}
					this.load()
					uni.showToast({ title: '已删除', icon: 'none' })
				}
			})
		}
	}
}
</script>

<style scoped>
.card{padding:26rpx}.month,.edit-header{display:flex;justify-content:space-between;align-items:center}.month{padding:2rpx 8rpx 22rpx;color:#6f42c1}.month-button{width:64rpx;height:58rpx;border-radius:14rpx;background:#eee7fb;text-align:center;font-size:42rpx;line-height:52rpx}.month-title,.edit-title{font-size:28rpx;font-weight:700;color:#201534}.week,.calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:8rpx}.week text{text-align:center;font-size:21rpx;color:#756a87}.day{display:flex;min-height:78rpx;flex-direction:column;align-items:center;justify-content:center;gap:2rpx;border-radius:14rpx;background:#eee7fb}.day.blank{background:transparent}.day.empty{background:#fbf9ff}.day.selected{box-sizing:border-box;border:2rpx solid #6f42c1;background:#fff}.date{font-size:22rpx;color:#4b3b63}.value{font-size:20rpx;font-weight:700;color:#6f42c1;letter-spacing:-0.5rpx;white-space:nowrap}.value.tight{font-size:16rpx;letter-spacing:-1rpx}.day.empty .value{color:#c9c0d8;font-weight:400}.day.today .date{color:#6f42c1;font-weight:700}.day.future{background:#f9f7fd}.day.future .date{color:#cdc4dc}.day.future .value{color:#d8d0e4;font-weight:400}.gain{color:#6f42c1;font-size:28rpx;font-weight:700}.spend{color:#b56016;font-size:28rpx;font-weight:700}.flat{color:#8a7fa0;font-size:26rpx;font-weight:400}.edit{display:flex;flex-direction:column;gap:14rpx;margin-top:22rpx}.input{height:82rpx;padding:0 22rpx;border:1rpx solid #e5def0;border-radius:16rpx;background:#fbf9ff;font-size:30rpx;line-height:82rpx}.primary{border:0;border-radius:20rpx;background:#6f42c1;color:#fff;font-size:28rpx;font-weight:700;line-height:86rpx}.primary::after{border:0}.saved{font-size:24rpx;color:#6f42c1;text-align:center}.hint{font-size:23rpx;line-height:1.5;color:#8a7fa0}.delete-link{align-self:center;margin-top:6rpx;padding:10rpx 8rpx;font-size:23rpx;color:#b56016}
</style>
