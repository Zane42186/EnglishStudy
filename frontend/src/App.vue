<script setup>
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import SiteNav from './components/SiteNav.vue';
import { pageTitle } from './stores/pageTitle.js';

/* 应用外壳（2026-10-02 全站迁移完成）
 *
 * · 顶部导航 + 页面标题由路由 meta 驱动（nav / title）；单课详情可用 pageTitle 覆盖 <h1>
 * · 版心宽度按 meta.wrap 切换，对齐各原生页的 .wrap 宽度
 *   （首页/词汇卡 1200、阅读 1080、错词本与单课详情沿用共享层默认 900）
 * · 视图自行渲染页面主体与页脚提示（与原生页一一对应）
 */
const route = useRoute();
const nav = computed(() => route.meta.nav || 'home');
const title = computed(() => pageTitle.value || route.meta.title || '英语学习平台');
const wrapClass = computed(() => route.meta.wrap || '');

/* 路由切换即清空标题覆盖，避免「第 6 课」残留在别的页面上 */
watch(function () { return route.fullPath; }, function () { pageTitle.value = ''; });
watch(title, function (t) { document.title = t; }, { immediate: true });
</script>

<template>
  <div class="wrap" :class="wrapClass">
    <SiteNav :active="nav" :title="title" />
    <RouterView />
  </div>
</template>

<style>
/* 版心宽度：与原生各页页内 .wrap 覆盖一致（共享层默认 900） */
.wrap-home, .wrap-words { max-width: 1200px; }
.wrap-reading { max-width: 1080px; }
.wrap-narrow { max-width: 900px; }
</style>
