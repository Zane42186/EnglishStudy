<script setup>
/* 词汇卡（试点页）· Vue 3 版
 *
 * 对应原生页 review/words.html，行为逐项对齐：
 *   · 取数：GET /vocabulary/stats（total）+ GET /vocabulary 全量（API.getAll，分页取完）
 *   · 布局：左栏 = 搜索框 + A-Z 两列索引（sticky）；主区 = 按字母分组的卡片
 *   · 交互：点击卡片翻出中文/例句（原 .show 类）；搜索即时过滤
 * 有意的 Vue 化差异（与原生版等价、但更可测）：
 *   过滤从「UI.bindFilter 隐藏 DOM」改为 **computed 数据过滤**；卡片从 innerHTML 拼接改为模板渲染
 *   （转义由 Vue 自动完成，不再依赖 UI.esc）。
 */
import { ref, computed, onMounted } from 'vue';
import { API } from '../api.js';
import ApiErrorBar from '../components/ApiErrorBar.vue';

const loading = ref(true);
const errorMsg = ref('');
const total = ref(null);
const list = ref([]);
const keyword = ref('');
const opened = ref({});

function letterOf(word) {
  const c = String(word || '').charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

/* 按字母分组（组内按单词排序）—— 口径同原生页 renderGroups */
const groups = computed(() => {
  const g = {};
  list.value.forEach(function (w) {
    const L = letterOf(w.word);
    (g[L] = g[L] || []).push(w);
  });
  return Object.keys(g).sort().map(function (L) {
    return {
      letter: L,
      items: g[L].slice().sort(function (a, b) { return String(a.word).localeCompare(String(b.word)); })
    };
  });
});

/* 搜索过滤：命中字段 = word + meaning（转小写 includes）。
 * 2026-10-02 负责人裁定「只按单词/释义匹配」——去掉 example，
 * 避免搜 yesterday 却命中 bought/cooked 这类「仅例句含该词」的隐式命中（口径与原生版一致）。 */
const filteredGroups = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) { return groups.value; }
  return groups.value.map(function (g) {
    return {
      letter: g.letter,
      items: g.items.filter(function (w) {
        return [w.word, w.meaning].join('  ').toLowerCase().includes(kw);
      })
    };
  }).filter(function (g) { return g.items.length > 0; });
});

const isEmpty = computed(() => !loading.value && !errorMsg.value && filteredGroups.value.length === 0);
const emptyText = computed(() => (keyword.value.trim() ? '没有匹配的词汇，换个关键词试试' : '暂无词汇记录'));
/* 搜索态命中卡自动展开（2026-10-02 负责人报「搜 yesterday 出现 bought 像乱命中」）：
 * 无论命中来自单词还是释义，卡片默认收起都会让命中原因不可见。
 * 修法＝搜索态下全部命中卡展开（中文/例句可见），清空恢复收起（回到「先回想再核对」的自测模式）。 */
const hasKeyword = computed(() => keyword.value.trim() !== '');

async function load() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const r = await Promise.all([
      API.get('/vocabulary/stats'),
      API.getAll('/vocabulary', { size: 100 })
    ]);
    total.value = r[0].total;
    list.value = r[1].list;
  } catch (e) {
    errorMsg.value = e.message;
  } finally {
    loading.value = false;
  }
}

function toggle(word) { opened.value[word] = !opened.value[word]; }

onMounted(load);
</script>

<template>
  <p class="sub">按首字母分组，点击卡片翻出中文与例句。<span v-if="total != null">　共 {{ total }} 个词条（按单词去重）</span></p>

  <ApiErrorBar :msg="errorMsg" @retry="load" />

  <div class="words-layout">
    <aside class="words-side">
      <input v-model="keyword" placeholder="搜索单词/释义">
      <div class="idx-v">
        <a v-for="g in groups" :key="g.letter" :href="'#letter-' + g.letter">{{ g.letter }}</a>
      </div>
    </aside>

    <section class="words-main">
      <p v-if="loading" class="state loading">正在加载词汇…</p>
      <p v-else-if="isEmpty" class="state">{{ emptyText }}</p>
      <template v-else>
        <div v-for="g in filteredGroups" :key="g.letter" class="group">
          <h2 :id="'letter-' + g.letter">{{ g.letter }}<span class="count">{{ g.items.length }} 个</span></h2>
          <div class="words">
            <div v-for="w in g.items" :key="w.id != null ? w.id : w.word" class="wcard"
              :class="{ show: !!opened[w.word] || hasKeyword }" @click="toggle(w.word)">
              <div class="w">{{ w.word }}</div>
              <div class="p">{{ w.phonetic || '' }}</div>
              <div class="c">{{ w.meaning || '' }}</div>
              <div class="e">{{ w.example || '' }}</div>
              <div v-if="w.firstLessonNo" class="src">第 {{ w.firstLessonNo }} 课首次出现</div>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
/* 页内布局样式（移植自 words.html 的页内 <style>；共享层 board.css 已在 main.js 全局引入）
 * ① 内容整体左移：版心 900 → 1200（见 App.vue）
 * ② 搜索框在左栏、位于索引上方
 * ③ 字母索引两列网格、块放大约 1.5 倍；左栏 sticky 跟随滚动 */
.words-layout { display: flex; gap: 14px; align-items: flex-start; }
.words-side { width: 104px; flex: 0 0 auto; position: sticky; top: 12px; }
.words-side input { width: 100%; box-sizing: border-box; padding: 7px 9px; font-size: 13px;
  border: 1px solid #d9d8d2; border-radius: 8px; margin-bottom: 10px; }
.idx-v { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px;
  max-height: calc(100vh - 60px); overflow: auto; padding-right: 2px; }
.idx-v a { display: block; text-align: center; background: #fff; border: 1px solid #d9d8d2;
  border-radius: 8px; padding: 7px 0; font-size: 17px; text-decoration: none; color: inherit; }
.idx-v a:hover { border-color: #185fa5; }
.words-main { flex: 1 1 auto; min-width: 0; }
/* 首个字母组标题与左栏搜索框顶部对齐（抵消 board.css h2 的 24px 上边距） */
.words-main > .group:first-child h2 { margin-top: 0; }
@media (max-width: 720px) {
  .words-layout { flex-direction: column; }
  .words-side { position: static; width: auto; }
  .idx-v { grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); max-height: none; }
}
</style>
