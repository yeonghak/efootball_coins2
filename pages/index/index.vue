<template>
	<view class="page">
		<view class="header"><text class="app-name">攒币助手</text><text class="sync-text">{{ syncText }}</text></view>
		<view class="content content--tab">
			<view class="balance-card">
				<view class="bal-head">
					<text class="balance-label">当前金币</text>
					<view class="goal-edit" hover-class="goal-edit-hover" @tap="goGoal"><text class="goal-edit-text">修改目标</text><text class="goal-edit-arrow">›</text></view>
				</view>
				<view class="balance-row"><image class="coin-icon" src="/static/coin.svg" mode="aspectFit" /><text class="balance-value">{{ currentCoinsText }}</text></view>
				<view class="progress-track"><view class="progress-bar" :style="{ width: progress + '%' }"></view></view>
				<view class="progress-row" @tap="goGoal"><text>目标：{{ targetCoinsText }}</text><text>{{ progress }}%</text></view>
				<view class="goal-foot" @tap="goGoal"><text class="goal-foot-name">{{ goalNameText }}</text><text class="goal-foot-remain">{{ remainText }}</text></view>
			</view>
			<button class="record-button" @tap="goRecord">记录一笔金币</button>
			<view class="metrics">
				<view class="metric-card"><text class="metric-label">每日需攒</text><text class="metric-value">{{ dailyNeedText }}</text><text class="metric-note">{{ daysLeftText }}</text></view>
				<view class="metric-card"><text class="metric-label">近 7 天增长</text><text class="metric-value">{{ weekGrowthText }}</text><text class="metric-note">{{ weekCompareText }}</text></view>
			</view>
			<view class="section-title-row"><text class="section-title">最近记录</text><text class="more-text" @tap="goHistory">查看全部</text></view>
			<view class="records-card">
				<view v-if="!recentRecords.length" class="record-item" style="justify-content:center;color:#756a87;font-size:26rpx">还没有记录，先记下当前的金币总额吧。</view>
				<view v-for="(record, index) in recentRecords" :key="record.id" class="record-item" :class="{ 'record-divider': index > 0 }">
					<view class="record-main">
						<text class="record-name">{{ record.dateLabel }}</text>
						<text class="record-time">{{ record.subText }}</text>
					</view>
					<view class="record-right">
						<text class="record-amount">{{ record.balanceText }}</text>
						<text class="record-delta" :class="record.deltaClass">{{ record.deltaText }}</text>
					</view>
				</view>
			</view>
		</view>
		<app-tabbar active="home" />
	</view>
</template>

<script>
	import AppTabbar from '@/components/AppTabbar.vue'
	import { getData, getCurrentCoins, getGoalRemaining, getGoalProgress, getDaysLeft, getDailyNeed, getRollingNet, getChangeOn, getLatestRecord, formatDateKey } from '@/utils/storage'
	import { formatNumber, formatSigned, formatDayLabel } from '@/utils/format'

	export default {
		components: { AppTabbar },
		data() {
			return {
				currentCoins: 0, targetCoins: 0, remainingCoins: 0, progress: 0,
				remainingDays: 0, dailyNeed: 0, weekGrowth: 0, weekGrowthPrev: 0,
				goalName: '', recentRecords: [], syncText: ''
			}
		},
		computed: {
			currentCoinsText() { return formatNumber(this.currentCoins) },
			targetCoinsText() { return formatNumber(this.targetCoins) },
			dailyNeedText() {
				if (this.remainingCoins <= 0) return '已达成'
				if (this.remainingDays <= 0) return '—'
				return formatNumber(this.dailyNeed)
			},
			daysLeftText() {
				if (this.remainingCoins <= 0) return '目标已完成'
				return this.remainingDays > 0 ? `剩余 ${this.remainingDays} 天` : '目标日期已到'
			},
			weekGrowthText() { return formatSigned(this.weekGrowth) },
			weekCompareText() {
				const diff = this.weekGrowth - this.weekGrowthPrev
				if (diff === 0) return '与前 7 天持平'
				return `比前 7 天 ${diff > 0 ? '+' : '-'}${formatNumber(Math.abs(diff))}`
			},
			goalNameText() { return this.goalName || '未命名目标' },
			remainText() {
				if (this.remainingCoins <= 0) return '已达成'
				if (this.remainingDays <= 0) return '日期已过'
				return `还差 ${formatNumber(this.remainingCoins)} 金币`
			}
		},
		onShow() {
			this.refresh()
		},
		methods: {
			refresh() {
				const data = getData()
				this.currentCoins = getCurrentCoins(data)
				this.targetCoins = data.goal.targetCoins
				this.remainingCoins = getGoalRemaining(data)
				this.progress = getGoalProgress(data)
				this.remainingDays = getDaysLeft(data.goal.targetDate)
				this.dailyNeed = getDailyNeed(data)
				// 近 7 天与统计页「最近 7 天」共用 getRollingNet，数字必然一致
				this.weekGrowth = getRollingNet(data)
				const weekAgo = new Date()
				weekAgo.setDate(weekAgo.getDate() - 7)
				this.weekGrowthPrev = getRollingNet(data, 7, weekAgo)
				this.goalName = data.goal.name
				// 原来那句「同步于今天」是假文案（数据只在本机），换成真实的最后记录时间
				const latest = getLatestRecord(data, formatDateKey(new Date()))
				this.syncText = latest ? `上次记录 ${formatDayLabel(latest.date)}` : '仅保存在本机'
				this.recentRecords = data.records.slice(0, 4).map(record => {
					const delta = getChangeOn(data, record.date)
					return {
						id: record.id,
						dateLabel: formatDayLabel(record.date),
						subText: record.note || '当天账户总额',
						balanceText: formatNumber(record.balance),
						deltaText: delta ? formatSigned(delta) : '持平',
						deltaClass: delta ? (delta > 0 ? 'up' : 'down') : 'flat'
					}
				})
			},
			goRecord() { uni.reLaunch({ url: '/pages/calendar/calendar?focus=1' }) },
			goGoal() { uni.navigateTo({ url: '/pages/goal/goal' }) },
			goHistory() { uni.navigateTo({ url: '/pages/history/history' }) }
		}
	}
</script>

<style scoped>
.record-main{display:flex;flex-direction:column;gap:4rpx}.record-right{display:flex;flex-direction:column;align-items:flex-end;gap:4rpx}.record-delta{font-size:21rpx;font-weight:700}.up{color:#6f42c1}.down{color:#b56016}.flat{font-weight:400;color:#9a8fae}.header{display:flex;justify-content:space-between;align-items:center;padding:34rpx 36rpx 24rpx;background:#fff}.app-name{font-size:32rpx;font-weight:700}.sync-text,.metric-label,.metric-note,.record-time,.more-text{font-size:24rpx;color:#756a87}.balance-card{display:flex;flex-direction:column;gap:16rpx;padding:32rpx 34rpx;border-radius:32rpx;background:linear-gradient(135deg,#6f42c1,#9470dc);color:#fff;box-shadow:0 18rpx 38rpx rgba(82,42,147,.22)}.bal-head{display:flex;justify-content:space-between;align-items:center}.goal-edit{display:flex;align-items:center;gap:2rpx;padding:7rpx 16rpx;border-radius:999rpx;background:rgba(255,255,255,.2)}.goal-edit-hover{background:rgba(255,255,255,.36)}.goal-edit-text{font-size:22rpx;font-weight:600;color:#fff}.goal-edit-arrow{font-size:24rpx;line-height:1;color:#fff}.goal-foot{display:flex;justify-content:space-between;align-items:center;gap:16rpx}.goal-foot-name{max-width:380rpx;overflow:hidden;font-size:23rpx;color:rgba(255,255,255,.82);text-overflow:ellipsis;white-space:nowrap}.goal-foot-remain{flex-shrink:0;font-size:23rpx;font-weight:600;color:rgba(255,255,255,.92)}.balance-label,.progress-row{font-size:24rpx;color:#f4ecff}.balance-row{display:flex;align-items:center;gap:18rpx}.coin-icon{width:68rpx;height:68rpx}.balance-value{font-size:68rpx;font-weight:700;line-height:1}.progress-track{height:16rpx;overflow:hidden;border-radius:999rpx;background:rgba(255,255,255,.28)}.progress-bar{height:100%;border-radius:inherit;background:#fff}.progress-row,.section-title-row,.record-item{display:flex;justify-content:space-between;align-items:center}.record-button{margin:24rpx 0 28rpx;border:0;border-radius:24rpx;background:#6f42c1;color:#fff;font-size:30rpx;font-weight:600;line-height:96rpx;box-shadow:0 12rpx 24rpx rgba(111,66,193,.18)}.record-button::after{border:0}.metrics{display:flex;gap:20rpx}.metric-card{display:flex;flex:1;flex-direction:column;gap:8rpx;padding:26rpx;border-radius:24rpx;background:#eee7fb}.metric-value{font-size:42rpx;font-weight:700;color:#6f42c1}.section-title-row{margin:36rpx 0 18rpx}.section-title{font-size:32rpx;font-weight:700}.more-text{color:#6f42c1}.records-card{overflow:hidden;border:1rpx solid #e5def0;border-radius:24rpx;background:#fff}.record-item{padding:26rpx 28rpx}.record-divider{border-top:1rpx solid #eee9f5}.record-name{display:block;margin-bottom:8rpx;font-size:28rpx;font-weight:600}.record-amount{font-size:30rpx;font-weight:700;color:#6f42c1}
</style>
