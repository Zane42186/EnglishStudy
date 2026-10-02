<script setup>
import { computed, reactive, watch, onMounted, nextTick } from 'vue';
import { renderMarkdown } from '../utils/markdown.js';
import { label } from '../utils/labels.js';
import { ORDER, HIDDEN_TYPES, shouldOpen, isMobileViewport } from '../utils/lessonSections.js';

/* 课程小节区块（首页课程区与单课详情共用）
 * 来源：原生 index.html / lesson.html 的 renderSelfCheck + renderSections（原生站已于 2026-10-02 退役，
 *      见 docs/plans/frontend-plan.md §14；本组件为其等价实现）
 *
 * 契约：8 个已知小节按 ORDER 顺序渲染，库里缺失的**显式标注**（绝不静默少给）；
 *       未列出的新增 sectionType 照常渲染（排除 Amy 裁定不展示的 expected_mistakes）。
 * 折叠：details/summary；默认展开规则见 utils/lessonSections.shouldOpen；
 *       一键全展开/全折叠，且按钮文案**随 toggle 事件实时同步**（2026-10-02 修的 bug：
 *       旧实现只在点击按钮时更新文案，手动折叠单节后文案残留、与动作相反）。
 * ⚠️ Vue 的 DOM 更新是异步批量的：自动化断言在「点击 #toggleAll / 直接改 details.open」后
 *    必须 await 一拍再读按钮文案或 details.open，否则读到更新前的值。
 */
const props = defineProps({
  lesson: { type: Object, required: true },
  /* 是否在自查清单区块上方渲染 <h2>提交前自查清单</h2>（lesson.html 有、首页无） */
  selfCheckHeading: { type: Boolean, default: false },
  openAll: { type: Boolean, default: false },
  deepType: { type: String, default: '' }
});

const MISSING_SECTION = '该小节正文未入库（后端缺口 G-2）。';
const MISSING_SELFCHECK = '自查清单数据未入库（后端缺口：GET /api/lessons/:id 未返回 exercises[].selfCheck）。';

const isMobile = isMobileViewport();
const openMap = reactive({});

/* 自查清单：数据源 exercises[].selfCheck（后端尚未落库 → 占位，不伪造） */
const selfCheckBlock = computed(() => {
  const lesson = props.lesson || {};
  let checks = [];
  if (lesson.exercises && lesson.exercises.length) {
    lesson.exercises.forEach(function (e) { if (e.selfCheck) { checks.push(e.selfCheck); } });
  } else if (lesson.selfChecks && lesson.selfChecks.length) {
    checks = lesson.selfChecks;
  }
  if (!checks.length) { return { type: 'selfcheck', missing: true, checks: [], missText: MISSING_SELFCHECK }; }
  return { type: 'selfcheck', missing: false, checks: checks, missText: '' };
});

const sectionBlocks = computed(() => {
  const lesson = props.lesson || {};
  const byType = {};
  (lesson.sections || []).forEach(function (s) { byType[s.sectionType] = s; });
  const known = ORDER.filter(function (t) { return HIDDEN_TYPES.indexOf(t) === -1; }).map(function (t) {
    if (byType[t]) { return { type: t, missing: false, html: renderMarkdown(byType[t].content), missText: '' }; }
    return { type: t, missing: true, html: '', missText: MISSING_SECTION };
  });
  const extra = (lesson.sections || []).filter(function (s) {
    return ORDER.indexOf(s.sectionType) === -1 && HIDDEN_TYPES.indexOf(s.sectionType) === -1;
  }).map(function (s) { return { type: s.sectionType, missing: false, html: renderMarkdown(s.content), missText: '' }; });
  return known.concat(extra);
});

const blocks = computed(() => [selfCheckBlock.value].concat(sectionBlocks.value));

/* 展开状态：每个 lesson 只初始化一次（用户后续的折叠/展开不被覆盖） */
watch(function () { return props.lesson && props.lesson.lessonNo; }, function () {
  Object.keys(openMap).forEach(function (k) { delete openMap[k]; });
  blocks.value.forEach(function (b) {
    openMap[b.type] = shouldOpen(b.type, { openAll: props.openAll, deepType: props.deepType, isMobile: isMobile });
  });
  nextTick(scrollToDeep);
}, { immediate: true });

const anyClosed = computed(function () {
  return blocks.value.some(function (b) { return !openMap[b.type]; });
});
const toggleLabel = computed(function () { return anyClosed.value ? '全部展开' : '全部折叠'; });

function toggleAll() {
  const open = anyClosed.value;
  blocks.value.forEach(function (b) { openMap[b.type] = open; });
}
/* details 的 open 是 DOM 属性，用户点 summary 不会改到我们的响应式状态 → 必须听 toggle 事件，
   否则「文案与动作不一致」的老 bug 会复现（与原生版同款修法）。 */
function onToggle(type, e) { openMap[type] = e.target.open; }

function scrollToDeep() {
  const m = /^#sec-(.+)$/.exec(location.hash || '');
  if (!m) { return; }
  const target = document.getElementById('sec-' + m[1]);
  if (target && target.scrollIntoView) { target.scrollIntoView(); }
}
onMounted(function () { nextTick(scrollToDeep); });
</script>

<template>
  <div class="sec-tools">
    <button class="btn" type="button" id="toggleAll" @click="toggleAll">{{ toggleLabel }}</button>
  </div>

  <h2 v-if="selfCheckHeading">提交前自查清单</h2>

  <section v-for="b in blocks" :key="b.type" class="sec" :class="{ missing: b.missing }"
    :data-type="b.type" :id="'sec-' + b.type">
    <details :open="openMap[b.type]" @toggle="onToggle(b.type, $event)">
      <summary><h4>{{ label('sectionType', b.type) }}</h4></summary>
      <div class="secbody">
        <template v-if="b.type === 'selfcheck' && !b.missing">
          <ul class="selfcheck">
            <li v-for="(c, i) in b.checks" :key="i">{{ c }}</li>
          </ul>
        </template>
        <template v-else-if="b.missing">
          <!-- 原生版已退役（2026-10-02）：原来的「查看静态版全文」兜底链一并移除。
               缺失小节只留中性说明，等 G-2（小节正文/自查项入库）补齐后自然消失。 -->
          <span>{{ b.missText }}</span>
        </template>
        <div v-else v-html="b.html"></div>
      </div>
    </details>
  </section>
</template>

<style scoped>
.sec { background: #fff; border: 1px solid #e3e2dc; border-radius: 10px; padding: 10px 14px; margin-bottom: 10px; }
.sec details { margin: 0; }
.sec summary { cursor: pointer; list-style: none; }
.sec summary::-webkit-details-marker { display: none; }
.sec summary h4 { display: inline-block; margin: 0; font-size: 14px; }
.sec summary::before { content: "\25B8 "; color: #88877f; font-size: 12px; }
.sec details[open] summary::before { content: "\25BE "; }
.sec .secbody { margin-top: 6px; font-size: 14px; overflow-x: auto; }
.sec .secbody :deep(table) { width: 100%; border-collapse: collapse; font-size: 13px; }
.sec .secbody :deep(th), .sec .secbody :deep(td) { border: 1px solid #e3e2dc; padding: 4px 8px; text-align: left; }
.sec.missing { border-style: dashed; background: #fbfbf9; }
.sec.missing .secbody { color: #88877f; font-size: 13px; margin: 6px 0 0; }
.selfcheck li { margin: 2px 0; }
.sec-tools { margin: 10px 0 6px; }
</style>
