<template>
	<view class="tabbar">
		<view v-for="item in items" :key="item.key" class="tab-item" :class="{ active: active === item.key }" @tap="go(item)">
			<image :src="item.icon" class="tab-icon" mode="aspectFit" />
			<text>{{ item.label }}</text>
		</view>
	</view>
</template>

<script>
	export default {
		props: { active: { type: String, required: true } },
		data() {
			return { items: [
				{ key: 'home', label: '首页', path: '/pages/index/index', icon: '/static/icons/home.svg' },
				{ key: 'calendar', label: '日历', path: '/pages/calendar/calendar', icon: '/static/icons/calendar.svg' },
				{ key: 'stats', label: '统计', path: '/pages/stats/stats', icon: '/static/icons/stats.svg' },
				{ key: 'profile', label: '我的', path: '/pages/profile/profile', icon: '/static/icons/profile.svg' }
			] }
		},
		methods: { go(item) { if (item.key !== this.active) uni.reLaunch({ url: item.path }) } }
	}
</script>

<style scoped>
.tabbar{position:fixed;z-index:10;right:0;bottom:0;left:0;display:flex;padding:14rpx 6rpx calc(14rpx + env(safe-area-inset-bottom));background:#fff;border-top:1rpx solid #e5def0}.tab-item{display:flex;flex:1;flex-direction:column;align-items:center;gap:5rpx;color:#756a87;font-size:20rpx}.tab-item.active{color:#6f42c1;font-weight:700}.tab-icon{width:36rpx;height:36rpx}.active .tab-icon{filter:opacity(.95)}
</style>
