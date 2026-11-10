<template>
	<view class="page">
		<view class="content">
			<view class="intro">
				<text class="title">我的攒币目标</text>
				<text class="subtitle">把目标拆成每天都能做到的进度。</text>
			</view>
			<view class="hero">
				<text class="hero-label">{{ achieved ? '已达成' : '正在进行' }}</text>
				<text class="hero-title">{{ form.name || '未命名目标' }}</text>
				<view class="row"><text>{{ currentCoinsText }} / {{ targetCoinsText }}</text><text>{{ remainingText }}</text></view>
				<view class="track"><view class="bar" :style="{ width: progress + '%' }"></view></view>
				<text class="percent">{{ progress }}%</text>
			</view>
			<view class="card">
				<text class="label">目标名称</text>
				<input v-model="form.name" class="input" placeholder="例如：冬季精选抽卡"/>
				<text class="label">目标金币</text>
				<input v-model="form.targetCoins" class="input" type="number" placeholder="输入目标金币数"/>
				<view class="info-row">
					<text>目标日期</text>
					<picker mode="date" :value="form.targetDate" :start="todayKey" @change="changeDate">
						<text class="picker-value">{{ targetDateLabel }}</text>
					</picker>
				</view>
				<view class="info-row"><text>每日建议</text><text class="purple">{{ dailyNeedText }}</text></view>
				<view class="info-row"><text>剩余天数</text><text>{{ daysLeftText }}</text></view>
			</view>
			<button class="secondary" @tap="save">保存目标</button>
		</view>
	</view>
</template>

<script>
import { getData, saveGoal, getCurrentCoins, getDaysLeft, computeDailyNeed, formatDateKey } from '@/utils/storage'
import { formatNumber, formatMonthDay } from '@/utils/format'

export default {
	data() {
		return {
			form: { name: '', targetCoins: '', targetDate: '' },
			currentCoins: 0,
			todayKey: formatDateKey(new Date())
		}
	},
	computed: {
		targetNumber() {
			const raw = String(this.form.targetCoins == null ? '' : this.form.targetCoins).replace(/[^\d]/g, '')
			return raw ? Number(raw) : 0
		},
		currentCoinsText() { return formatNumber(this.currentCoins) },
		targetCoinsText() { return formatNumber(this.targetNumber) },
		remaining() { return Math.max(this.targetNumber - this.currentCoins, 0) },
		remainingText() { return this.remaining > 0 ? `还差 ${formatNumber(this.remaining)}` : '已达成' },
		achieved() { return this.targetNumber > 0 && this.remaining === 0 },
		progress() {
			if (!this.targetNumber) return 0
			return Math.min(Math.max(Math.round(this.currentCoins / this.targetNumber * 100), 0), 100)
		},
		targetDateLabel() { return formatMonthDay(this.form.targetDate) || '未设置' },
		daysLeft() { return getDaysLeft(this.form.targetDate) },
		daysLeftText() { return this.daysLeft > 0 ? `${this.daysLeft} 天` : '已到期' },
		dailyNeedText() {
			if (this.remaining <= 0) return '目标已达成'
			if (!this.daysLeft) return `还差 ${formatNumber(this.remaining)}`
			// 与首页共用 computeDailyNeed，避免两处各自 ceil 出不同结果；
			// 这里用表单值而非已存目标，保证改数字时预览实时跟手
			return `攒 ${formatNumber(computeDailyNeed(this.remaining, this.daysLeft))} 金币`
		}
	},
	onShow() {
		this.load()
	},
	methods: {
		load() {
			const data = getData()
			this.form = {
				name: data.goal.name,
				targetCoins: String(data.goal.targetCoins),
				targetDate: data.goal.targetDate
			}
			this.currentCoins = getCurrentCoins(data)
			this.todayKey = formatDateKey(new Date())
		},
		changeDate(event) {
			this.form.targetDate = event.detail.value
		},
		save() {
			const name = String(this.form.name || '').trim()
			if (!name) {
				uni.showToast({ title: '请填写目标名称', icon: 'none' })
				return
			}
			if (this.targetNumber <= 0) {
				uni.showToast({ title: '目标金币需大于 0', icon: 'none' })
				return
			}
			const result = saveGoal(getData(), { name, targetCoins: this.targetNumber, targetDate: this.form.targetDate })
			if (!result) {
				uni.showToast({ title: '保存失败，请重试', icon: 'none' })
				return
			}
			this.load()
			uni.showToast({ title: '目标已保存', icon: 'success' })
			setTimeout(() => uni.navigateBack(), 600)
		}
	}
}
</script>

<style scoped>
.hero{display:flex;flex-direction:column;gap:18rpx;padding:34rpx;border-radius:28rpx;background:linear-gradient(135deg,#6f42c1,#9470dc);color:#fff}.hero-label{font-size:24rpx;color:#f4ecff}.hero-title{font-size:36rpx;font-weight:700}.row,.info-row{display:flex;justify-content:space-between;align-items:center;font-size:25rpx}.track{height:16rpx;overflow:hidden;border-radius:999rpx;background:rgba(255,255,255,.3)}.bar{height:100%;border-radius:inherit;background:#fff}.percent{text-align:right;font-size:24rpx}.card{display:flex;flex-direction:column;gap:14rpx;margin-top:24rpx;padding:30rpx}.input{height:82rpx;padding:0 22rpx;border:1rpx solid #e5def0;border-radius:16rpx;background:#fbf9ff;font-size:28rpx;line-height:82rpx}.info-row{margin-top:8rpx;padding-top:20rpx;border-top:1rpx solid #eee9f5}.purple,.picker-value{color:#6f42c1;font-weight:700}.secondary{margin-top:26rpx;border:0;border-radius:24rpx;background:#eee7fb;color:#6f42c1;font-size:30rpx;font-weight:700;line-height:96rpx}.secondary::after{border:0}
</style>
