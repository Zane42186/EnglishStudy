import { ref } from 'vue';

/* 页面 <h1> 标题覆盖位（App 默认用路由 meta.title）
 * 单课详情要在 h1 显示「第 N 课 · 日期」（与原生 lesson.html 的 #ltitle 一致），
 * 由视图在数据就绪后写入；路由切换时 App 会清空，回落到 meta.title。
 */
export const pageTitle = ref('');
