import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import ReadingView from '../views/ReadingView.vue';
import WordsView from '../views/WordsView.vue';
import WrongView from '../views/WrongView.vue';
import LessonView from '../views/LessonView.vue';

/* 路由表（2026-10-02 全站迁移）
 *
 * 与原生版的对应关系：
 *   /                 ← review/index.html          首页（课程区：左目录 + 单课正文 + 上一课/下一课）
 *   /reading/:date?   ← review/reading.html        阅读（date 为 'YYYY-MM-DD'，缺省取最新一天）
 *   /words            ← review/words.html          词汇卡
 *   /wrong            ← review/wrong.html          错词本
 *   /lesson/:no       ← review/lessons/lesson.html 单课详情（no = 课号，非主键 id）
 *
 * 采用 HTML5 history（干净 URL）；部署需 SPA 回退 → 随工程提供 serve.cjs（静态服务 + 回退到 index.html）。
 * 深链等价性：原生阅读页用 `#<date>`，Vue 版改为路径参数 `/reading/<date>`（可刷新、可分享直达，
 * 能力等价、形式更规整，避免与 hash 路由冲突）。
 */
const routes = [
  { path: '/', name: 'home', component: HomeView, meta: { nav: 'home', title: '英语复习看板', wrap: 'wrap-home' } },
  { path: '/reading/:date?', name: 'reading', component: ReadingView, meta: { nav: 'reading', title: '阅读', wrap: 'wrap-reading' } },
  { path: '/words', name: 'words', component: WordsView, meta: { nav: 'words', title: '词汇卡', wrap: 'wrap-words' } },
  { path: '/wrong', name: 'wrong', component: WrongView, meta: { nav: 'wrong', title: '错词本', wrap: 'wrap-narrow' } },
  { path: '/lesson/:no?', name: 'lesson', component: LessonView, meta: { nav: 'home', title: '课程详情', wrap: 'wrap-narrow' } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

export default createRouter({
  history: createWebHistory(),
  routes: routes,
  scrollBehavior: function () { return { top: 0 }; }
});
