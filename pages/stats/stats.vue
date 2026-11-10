<template>
	<view class="page">
		<view class="content content--tab">
			<view class="intro">
				<text class="title">{{ monthLabel }}攒币趋势</text>
				<text class="subtitle">{{ monthLabel }}共记录 {{ monthDays }} 天 · 净增长 {{ monthNetText }}</text>
			</view>
			<view v-for="(chart, index) in charts" :key="chart.id" class="card" :class="{ 'card-gap': index > 0 }">
				<view class="header">
					<text class="section-title">{{ chart.title }}</text>
					<text :class="chart.net >= 0 ? 'gain' : 'spend'">{{ chart.netText }}</text>
				</view>
				<view class="chart-box">
					<view class="plot" :style="{ width: plotWidth + 'rpx', height: plotHeight + 'rpx' }">
						<view v-for="(tick, ti) in chart.yTicks" :key="'grid-' + ti" class="grid" :style="{ top: tick.y + 'rpx' }"></view>
						<view class="axis-y"></view>
						<view class="axis-x"></view>
						<view v-if="chart.zeroY !== null" class="zero-line" :style="{ top: chart.zeroY + 'rpx' }"></view>
						<view v-for="seg in chart.segments" :key="seg.key" class="seg" :class="{ down: seg.down }" :style="{ left: seg.left + 'rpx', top: seg.top + 'rpx', width: seg.length + 'rpx', transform: 'rotate(' + seg.angle + 'deg)' }"></view>
						<view v-for="point in chart.points" :key="'dot-' + point.key" class="dot" :class="{ down: point.value < 0, head: point.isLast }" :style="{ left: point.dotLeft + 'rpx', top: point.dotTop + 'rpx' }"></view>
						<text v-for="point in chart.points" :key="'v-' + point.key" class="point-value" :class="{ down: point.value < 0 }" :style="{ left: point.x + 'rpx', top: point.labelTop + 'rpx' }">{{ point.valueText }}</text>
						<text v-for="(tick, ti) in chart.yTicks" :key="'y-' + ti" class="y-tick" :style="{ top: tick.y + 'rpx' }">{{ tick.text }}</text>
						<text v-if="!chart.hasRecord" class="plot-empty">这 7 天还没有记录</text>
					</view>
					<view class="x-labels" :style="{ width: plotWidth + 'rpx' }">
						<text v-for="point in chart.points" :key="'x-' + point.key" class="x-tick" :class="{ today: point.isToday }" :style="{ left: point.x + 'rpx' }">{{ point.label }}</text>
					</view>
				</view>
				<view class="legend"><text class="legend-item gain">增长</text><text class="legend-item spend">回落</text><text class="legend-note">{{ chart.note }}</text></view>
			</view>
			<view class="metrics">
				<view class="metric"><text>{{ monthLabel }}记录天数</text><b>{{ monthDays }} 天</b></view>
				<view class="metric"><text>日均增长</text><b>{{ dailyAverageText }}</b></view>
			</view>
		</view>
		<app-tabbar active="stats"/>
	</view>
</template>

<script>
import AppTabbar from '@/components/AppTabbar.vue'
import { getData, getDayIndex, formatDateKey, getRollingNet } from '@/utils/storage'
import { formatNumber, formatSigned } from '@/utils/format'

// 折线图按 596rpx 宽、200rpx 高绘制
// 左侧 64rpx 留给 Y 轴刻度文字，右侧 34rpx 防止末点的数据标签被裁掉
const CHART = { width: 596, height: 200, left: 64, right: 34, top: 34, bottom: 10 }
const DOT_SIZE = 16
const LABEL_GAP = 24

function round1(value) {
	return Math.round(value * 10) / 10
}

// 把一串点算成可直接渲染的线段 / 圆点 / 刻度，两张图共用同一套几何
function buildChart(series) {
	const values = series.map(item => item.value).concat(0)
	let max = Math.max.apply(null, values)
	let min = Math.min.apply(null, values)
	// 全平常（比如 7 天都持平）时撑开值域，否则曲线会压在轴线上
	if (max === min) { max += 1; min -= 1 }
	const span = max - min
	const plotWidth = CHART.width - CHART.left - CHART.right
	const plotHeight = CHART.height - CHART.top - CHART.bottom
	const step = series.length > 1 ? plotWidth / (series.length - 1) : 0
	const yOf = value => CHART.height - CHART.bottom - ((value - min) / span) * plotHeight

	const points = series.map((item, index) => {
		const x = CHART.left + step * index
		const y = yOf(item.value)
		return {
			key: item.key,
			label: item.label,
			value: item.value,
			isToday: !!item.isToday,
			isLast: index === series.length - 1,
			x: round1(x),
			y: round1(y),
			dotLeft: round1(x - DOT_SIZE / 2),
			dotTop: round1(y - DOT_SIZE / 2),
			// 数值标签贴在点的正上方
			labelTop: round1(y - DOT_SIZE / 2 - LABEL_GAP),
			valueText: item.showValue ? (item.value === 0 ? '0' : formatSigned(item.value)) : ''
		}
	})

	const segments = points.slice(0, points.length - 1).map((point, index) => {
		const next = points[index + 1]
		const dx = next.x - point.x
		const dy = next.y - point.y
		return {
			key: point.key + '-seg',
			left: point.x,
			top: point.y,
			length: round1(Math.sqrt(dx * dx + dy * dy)),
			angle: round1(Math.atan2(dy, dx) * 180 / Math.PI),
			// 线段颜色跟随起点值的正负：负值区间整段用回落色，比按斜率判断更好读
			down: point.value < 0
		}
	})

	// 上、中、下三条刻度，用来读出量级
	const yTicks = [max, (max + min) / 2, min].map(value => ({
		text: formatNumber(Math.round(value)),
		y: round1(yOf(value))
	}))

	return {
		points,
		segments,
		yTicks,
		// 值域跨越 0 时才需要单独画一条零线，否则零线就是 X 轴本身
		zeroY: min < 0 && max > 0 ? round1(yOf(0)) : null,
		hasRecord: series.some(item => item.hasRecord)
	}
}

export default {
	components: { AppTabbar },
	data() {
		return { data: null, records: [], startingCoins: 0, todayKey: formatDateKey(new Date()), plotWidth: CHART.width, plotHeight: CHART.height }
	},
	computed: {
		monthPrefix() { return this.todayKey.slice(0, 7) },
		monthLabel() { return `${Number(this.monthPrefix.slice(5, 7))} 月` },
		// 逐日索引统一由数据层计算，日历格子、编辑区基线、统计、历史共用
		dayIndex() {
			return getDayIndex({ records: this.records, startingCoins: this.startingCoins })
		},
		monthRecords() {
			return this.records.filter(record => record.date.slice(0, 7) === this.monthPrefix)
		},
		monthDays() { return this.monthRecords.length },
		monthNet() {
			return this.monthRecords.reduce((total, record) => total + (this.dayIndex[record.date] ? this.dayIndex[record.date].change : 0), 0)
		},
		monthNetText() { return formatSigned(this.monthNet) },
		dailyAverageText() {
			if (!this.monthDays) return '—'
			const average = Math.round(this.monthNet / this.monthDays)
			return average === 0 ? '持平' : formatSigned(average)
		},
		weekDays() {
			const today = new Date()
			const weeks = ['日', '一', '二', '三', '四', '五', '六']
			return Array.from({ length: 7 }, (_, index) => {
				const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index))
				return { key: formatDateKey(date), label: weeks[date.getDay()] }
			})
		},
		weekSeries() {
			return this.weekDays.map(day => {
				const entry = this.dayIndex[day.key]
				return {
					key: day.key,
					label: day.label,
					value: entry ? entry.change : 0,
					hasRecord: !!entry,
					// 没记录的天不标数字，否则看起来像「记录了持平」
					showValue: !!entry,
					isToday: day.key === this.todayKey
				}
			})
		},
		weekChart() { return buildChart(this.weekSeries) },
		// 与首页「近 7 天增长」共用 getRollingNet，两处数字必然一致
		weekNet() {
			return this.data ? getRollingNet(this.data) : 0
		},
		weekNetText() { return formatSigned(this.weekNet) },
		// 累计增量：7 天前从 0 开始，逐日累加，最后一点等于近 7 天净增
		trendSeries() {
			let running = 0
			return this.weekDays.map(day => {
				const entry = this.dayIndex[day.key]
				running += entry ? entry.change : 0
				return {
					key: day.key,
					label: day.label,
					value: running,
					hasRecord: !!entry,
					// 累计曲线每个点都有意义，即使当天没记录也要标出当前累计值
					showValue: true,
					isToday: day.key === this.todayKey
				}
			})
		},
		trendChart() { return buildChart(this.trendSeries) },
		// 两张图共用同一套渲染模板，只有标题、数据来源和右下角说明不同
		charts() {
			return [
				{ id: 'daily', title: '最近 7 天每日增量', note: '每天相对前一天的变化', net: this.weekNet, netText: this.weekNetText, ...this.weekChart },
				{ id: 'trend', title: '最近 7 天累计增量', note: '从 7 天前累计到今天', net: this.weekNet, netText: this.weekNetText, ...this.trendChart }
			]
		}
	},
	onShow() {
		const data = getData()
		this.data = data
		this.records = data.records
		this.startingCoins = data.startingCoins
		this.todayKey = formatDateKey(new Date())
	}
}
</script>

<style scoped>
.metric text{font-size:24rpx;color:#756a87}.card{padding:28rpx}.header{display:flex;justify-content:space-between;align-items:center}.section-title{font-size:30rpx;font-weight:700}.gain{font-size:28rpx;font-weight:700;color:#6f42c1}.spend{font-size:28rpx;font-weight:700;color:#b56016}.chart-box{margin-top:24rpx}.card-gap{margin-top:22rpx}.plot{position:relative;margin:0 auto}.grid{position:absolute;left:64rpx;right:34rpx;height:0;border-top:1rpx dashed #f2edfa}.axis-y{position:absolute;left:64rpx;top:34rpx;bottom:10rpx;width:1rpx;background:#d9cfe9}.axis-x{position:absolute;left:64rpx;right:34rpx;bottom:10rpx;height:1rpx;background:#d9cfe9}.zero-line{position:absolute;left:64rpx;right:34rpx;height:0;border-top:1rpx dashed #cbbde3}.seg{position:absolute;height:3rpx;margin-top:-1rpx;border-radius:2rpx;background:#6f42c1;transform-origin:0 50%}.seg.down{background:#e8a06a}.dot{position:absolute;box-sizing:border-box;width:16rpx;height:16rpx;border:3rpx solid #fff;border-radius:50%;background:#6f42c1}.dot.head{background:#4a22a0}.dot.down{background:#e8a06a}.point-value{position:absolute;font-size:18rpx;font-weight:700;color:#6f42c1;white-space:nowrap;transform:translateX(-50%)}.point-value.down{color:#b56016}.y-tick{position:absolute;left:0;width:56rpx;text-align:right;font-size:17rpx;color:#9a8fae;transform:translateY(-50%)}.x-labels{position:relative;height:34rpx;margin:10rpx auto 0}.x-tick{position:absolute;top:0;font-size:20rpx;color:#756a87;transform:translateX(-50%)}.x-tick.today{font-weight:700;color:#6f42c1}.plot-empty{position:absolute;top:84rpx;left:64rpx;right:34rpx;font-size:24rpx;color:#9a8fae;text-align:center}.legend{display:flex;align-items:center;gap:20rpx;margin-top:12rpx;font-size:20rpx;color:#9a8fae}.legend-item{font-size:20rpx;font-weight:700}.legend-note{margin-left:auto;font-size:20rpx;color:#9a8fae}.metrics{display:flex;gap:20rpx;margin-top:22rpx}.metric{display:flex;flex:1;flex-direction:column;gap:8rpx;padding:26rpx;border-radius:24rpx;background:#eee7fb}.metric b{font-size:40rpx;color:#6f42c1}
</style>
