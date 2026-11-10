<template>
	<view class="page">
		<view class="content content--tab">
			<view class="intro">
				<text class="title">我的</text>
				<text class="subtitle">让计划贴合你的游戏节奏。</text>
			</view>
			<view class="card">
				<view class="setting">
					<view>
						<view class="setting-head"><text class="setting-title">每日提醒</text><text class="setting-tag">即将支持</text></view>
						<text class="setting-note">接入订阅消息后可每天定时提醒</text>
					</view>
					<switch :checked="false" :disabled="true" color="#c9c0d8"/>
				</view>
			</view>
			<view class="card list">
				<view class="line"><text>当前金币</text><text class="value">{{ currentCoinsText }}</text></view>
				<view class="line" @tap="editStartingCoins"><text>初始金币</text><text class="value">{{ startingCoinsText }}<text v-if="!recordCount" class="edit-hint">修改</text></text></view>
				<view class="line"><text>累计记录</text><text class="value">{{ recordCount }} 条</text></view>
				<view class="line" @tap="goHistory"><text>全部记录</text><text class="arrow">›</text></view>
				<!-- 数据导出：暂时隐藏入口，exportData 方法保留，恢复时取消注释即可 -->
				<!-- <view class="line" @tap="exportData"><text>数据导出</text><text class="arrow">›</text></view> -->
				<view class="line" @tap="showAbout"><text>关于本工具</text><text class="arrow">›</text></view>
			</view>
			<view class="version">攒币助手 · 0.1.0</view>
		</view>
		<app-tabbar active="profile"/>
	</view>
</template>

<script>
import AppTabbar from '@/components/AppTabbar.vue'
import { getData, setStartingCoins, getCurrentCoins } from '@/utils/storage'
import { formatNumber } from '@/utils/format'

export default {
	components: { AppTabbar },
	data() {
		return { startingCoins: 0, currentCoins: 0, recordCount: 0 }
	},
	computed: {
		startingCoinsText() { return formatNumber(this.startingCoins) },
		currentCoinsText() { return formatNumber(this.currentCoins) }
	},
	onShow() {
		this.load()
	},
	methods: {
		load() {
			const data = getData()
			this.startingCoins = data.startingCoins
			this.currentCoins = getCurrentCoins(data)
			this.recordCount = data.records.length
		},
		editStartingCoins() {
			if (this.recordCount > 0) {
				uni.showToast({ title: '已有记录，初始金币不可修改', icon: 'none' })
				return
			}
			uni.showModal({
				title: '修改初始金币',
				editable: true,
				content: String(this.startingCoins),
				placeholderText: '输入开始记账时的金币数',
				success: res => {
					if (!res.confirm) return
					if (res.content === undefined) {
						uni.showToast({ title: '当前环境不支持编辑', icon: 'none' })
						return
					}
					const raw = String(res.content).replace(/[^\d]/g, '')
					if (!raw) {
						uni.showToast({ title: '请输入数字', icon: 'none' })
						return
					}
					const result = setStartingCoins(getData(), Number(raw))
					if (!result) {
						uni.showToast({ title: '保存失败，请重试', icon: 'none' })
						return
					}
					this.load()
					uni.showToast({ title: '初始金币已更新', icon: 'success' })
				}
			})
		},
		goHistory() {
			uni.navigateTo({ url: '/pages/history/history' })
		},
		exportData() {
			const data = getData()
			uni.setClipboardData({
				data: JSON.stringify(data, null, 2),
				success: () => uni.showToast({ title: `已复制 ${data.records.length} 条记录`, icon: 'none' }),
				fail: () => uni.showToast({ title: '复制失败', icon: 'none' })
			})
		},
		showAbout() {
			uni.showModal({
				title: '关于攒币助手',
				content: '用于记录 eFootball 账户金币总额、追踪攒币目标。数据保存在本机，不会上传任何服务器。',
				showCancel: false,
				confirmText: '知道了'
			})
		}
	}
}
</script>

<style scoped>
.setting-note,.version{font-size:24rpx;color:#756a87}.card{margin-bottom:22rpx}.setting,.line{display:flex;justify-content:space-between;align-items:center;padding:30rpx}.setting-title{font-size:29rpx;font-weight:700}.setting-head{display:flex;align-items:center;gap:12rpx;margin-bottom:10rpx}.setting-tag{padding:2rpx 12rpx;border-radius:999rpx;background:#f1ecf9;font-size:20rpx;font-weight:400;color:#8a7fa0}.list{overflow:hidden}.line{font-size:29rpx;border-bottom:1rpx solid #eee9f5}.line:last-child{border:0}.value{color:#6f42c1;font-weight:700}.edit-hint{margin-left:12rpx;font-size:22rpx;font-weight:400;color:#a99ec0}.arrow{font-size:38rpx;color:#756a87}.version{display:block;margin-top:42rpx;text-align:center}
</style>
