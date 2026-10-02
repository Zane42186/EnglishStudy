<script setup>
/* 全站顶部导航（首页 / 阅读 / 词汇卡 / 错词本，当前页蓝底高亮）
 *
 * 2026-10-02 全站迁移完成：四项全部走 vue-router（RouterLink），
 * 不再依赖 VITE_LEGACY_BASE 指向原生页（原渐进期的 legacy 回退已移除）。
 */
defineProps({
  active: { type: String, default: '' },
  title: { type: String, default: '英语学习平台' }
});

const items = [
  { key: 'home', label: '首页', to: '/' },
  { key: 'reading', label: '阅读', to: '/reading' },
  { key: 'words', label: '词汇卡', to: '/words' },
  { key: 'wrong', label: '错词本', to: '/wrong' }
];
</script>

<template>
  <div class="top-bar">
    <h1>{{ title }}</h1>
    <nav class="site-nav">
      <RouterLink v-for="it in items" :key="it.key" :to="it.to" :class="{ on: it.key === active }">
        {{ it.label }}
      </RouterLink>
    </nav>
  </div>
</template>
