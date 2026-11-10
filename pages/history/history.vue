<template>
	<view class="page">
		<view class="content">
			<view class="intro">
				<text class="title">记录历史</text>
				<text class="subtitle">共 {{ records.length }} 条 · 当前 {{ currentCoinsText }} 金币</text>
				<text class="hint">轻触任意一条查看并修改 ›</text>
			</view>
			<view class="card">
				<view v-if="!records.length" class="empty">还没有任何记录</view>
				<view v-for="(item, index) in records" :key="item.id" class="row" :class="{ divider: index > 0 }" hover-class="row-hover" @tap="editItem(item)">
					<view class="row-main">
						<text class="row-date">{{ item.dateLabel }}</text>
						<text v-if="item.note" class="row-note">{{ item.note }}</text>
					</view>
					<view class="row-right">
						<text class="row-value">{{ item.balanceText }}</text>
						<text class="row-delta" :class="item.deltaClass">{{ item.deltaText }}</text>
					</view>
					<text class="row-edit">编辑 ›</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { getData, getCurrentCoins, getDayIndex } from '@/utils/storage'
import { formatNumber, formatSigned, formatDayLabel } from '@/utils/format'

export default {
	data() {
		return { records: [], currentCoins: 0 }
	},
	computed: {
		currentCoinsText() { return formatNumber(this.currentCoins) }
	},
	onShow() {
		this.load()
	},
	methods: {
		load() {
			const data = getData()
			this.currentCoins = getCurrentCoins(data)
			// 逐日索引统一由数据层计算，这里只按倒序取每行的增量
			const index = getDayIndex(data)
			this.records = data.records.map(record => {
				const entry = index[record.date]
				const delta = entry ? entry.change : 0
				return {
					id: record.id,
					date: record.date,
					balance: record.balance,
					dateLabel: formatDayLabel(record.date),
					note: record.note,
					balanceText: formatNumber(record.balance),
					deltaText: delta === 0 ? '持平' : formatSigned(delta),
					deltaClass: delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
				}
			})
		},
		editItem(item) {
			// 复用日历页的编辑区（有基线提示、备注、删除），不另做一套表单
			uni.navigateTo({ url: `/pages/calendar/calendar?date=${item.date}` })
		}
	}
}
</script>

<style scoped>
.hint{font-size:24rpx;font-weight:600;color:#6f42c1}.card{overflow:hidden;padding:0 28rpx}.empty{padding:60rpx 0;text-align:center;font-size:26rpx;color:#8a7fa0}.row{display:flex;align-items:center;gap:16rpx;padding:26rpx 0;transition:transform .12s ease,background .12s ease}.divider{border-top:1rpx solid #eee9f5}.row-main{display:flex;flex:1;flex-direction:column;gap:6rpx;overflow:hidden}.row-date{font-size:28rpx;font-weight:600}.row-note{font-size:23rpx;color:#756a87;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row-right{display:flex;flex-direction:column;align-items:flex-end;gap:4rpx}.row-value{font-size:30rpx;font-weight:700}.row-delta{font-size:21rpx;font-weight:700}.up{color:#6f42c1}.down{color:#b56016}.flat{font-weight:400;color:#8a7fa0}.row-edit{flex-shrink:0;padding:12rpx 0 12rpx 12rpx;font-size:22rpx;font-weight:600;color:#6f42c1;white-space:nowrap}.row-hover{background:#faf7ff;transform:translateX(6rpx)}
</style>
