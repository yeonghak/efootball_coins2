<script>
	import { getData } from '@/utils/storage'

	export default {
		onLaunch: function() {
			getData()
		}
	}
</script>

<style>
	/* 页面骨架：所有页面共用，各页面只在 scoped 里补充差异部分 */
	.page{min-height:100vh;background:#f6f2fc;color:#201534}
	.content{padding:34rpx 36rpx 60rpx}
	/* 底部有 tabbar 的页面再叠这个类：避开 tabbar 高度 + 安全区 */
	.content--tab{padding-bottom:200rpx}

	/* 标题区 */
	.intro{display:flex;flex-direction:column;gap:12rpx;margin-bottom:30rpx}
	.title{font-size:44rpx;font-weight:700}
	.subtitle,.label{font-size:24rpx;color:#756a87}

	/* 卡片外观；各页面按需补 padding / margin / gap */
	.card{border:1rpx solid #e5def0;border-radius:26rpx;background:#fff}
</style>
