<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { API } from '../api.js';
import ApiErrorBar from '../components/ApiErrorBar.vue';
import LessonSections from '../components/LessonSections.vue';
import LessonVocab from '../components/LessonVocab.vue';

/* 首页（课程区）· API 驱动 —— 对应 review/index.html（2026-10-02 全站迁移）
 *
 * 统计：/lessons（total）、/progress、/vocabulary/stats、/mistakes/stats、/readings/stats
 * 课程：API.lessonIndex()（优先 /lessons/all，失败回退分页全量）→ 左侧目录（按课号倒序）
 *       单课正文 = /lessons/:id + /lessons/:id/exercises（selfCheck 一旦落库即自动出现）
 * 交互：左侧切换课程、底部《上一课》《下一课》、键盘 ←/→ 同效；默认展示最新一课。
 * 需求⑤：「为什么今天学这个」「近 6 课错误趋势」按负责人指示**不渲染**（与原生版一致）。
 */
const route = useRoute();

const errMsg = ref('');

/* ---- 统计卡（分区块降级：某卡失败只让该卡显示 —，不整页报错） ---- */
const stats = reactive([
  { id: 'statLessons', label: '已上课数', v: '…', title: '' },
  { id: 'statLevel', label: '当前级别', v: '…', title: '' },
  { id: 'statVocab', label: '累计生词', v: '…', title: '' },
  { id: 'statReading', label: '阅读篇数', v: '…', title: '' },
  { id: 'statMistakes', label: '未过关错词', v: '…', title: '' }
]);
function statOf(id) { return stats.find(function (s) { return s.id === id; }); }
function setStat(id, v) { const s = statOf(id); s.v = (v == null ? '—' : String(v)); s.title = ''; }
function setUnknown(id, reason) { const s = statOf(id); s.v = '—'; s.title = reason; }

function errTextOf(e) {
  let msg = (e && e.message) || String(e);
  if (e && e.code === 0) { msg += '（请确认后端服务是否在运行）'; }
  return msg;
}
function partError(part, e) { errMsg.value = part + '加载失败：' + errTextOf(e); }

function loadStats() {
  const jobs = [
    API.getPage('/lessons', 1, 1).then(function (d) { setStat('statLessons', d.total); })
      .catch(function (e) { setUnknown('statLessons', '加载失败：' + e.message); partError('已上课数', e); }),
    API.get('/progress').then(function (d) { setStat('statLevel', d.currentLevel || '—'); })
      .catch(function (e) { setUnknown('statLevel', '加载失败：' + e.message); partError('当前级别', e); }),
    API.get('/vocabulary/stats').then(function (d) { setStat('statVocab', d.total); })
      .catch(function (e) { setUnknown('statVocab', '加载失败：' + e.message); partError('累计生词', e); }),
    API.get('/mistakes/stats').then(function (d) { setStat('statMistakes', d.pending); })
      .catch(function (e) { setUnknown('statMistakes', '加载失败：' + e.message); partError('未过关错词', e); }),
    /* 阅读篇数：pieceCount；tooltip 附天数 / 最近阅读 / 连续天数（「今天有没有读」前端比 lastReadDate===today） */
    API.get('/readings/stats').then(function (d) {
      setStat('statReading', d.pieceCount);
      const bits = [];
      if (d.totalDays) { bits.push('读了 ' + d.totalDays + ' 天'); }
      if (d.lastReadDate) { bits.push('最近 ' + d.lastReadDate); }
      if (d.currentStreakDays) { bits.push('连续 ' + d.currentStreakDays + ' 天'); }
      if (d.lastReadDate && d.lastReadDate === d.today) { bits.push('今天已读'); }
      if (bits.length) { statOf('statReading').title = bits.join(' ｜ '); }
    }).catch(function (e) { setUnknown('statReading', '加载失败：' + e.message); partError('阅读篇数', e); })
  ];
  return Promise.all(jobs);
}

/* ---- 课程目录 + 单课正文 ---- */
const lessons = ref([]);       // 按课号倒序（最新在前）
const curIdx = ref(0);
const curLesson = ref(null);
const loadingLesson = ref(false);
const emptyText = ref('');
const cache = {};
const keyword = ref('');

/* 深链/入参：#sec-<type> 展开该小节；?open=all 全展开 */
const deepType = computed(function () { return (String(location.hash || '').match(/^#sec-(.+)$/) || [])[1] || ''; });
const openAll = computed(function () { return String(route.query.open || '') === 'all'; });

/* 搜索：与原生版 UI.bindFilter 同语义 —— **保留全部目录项 DOM**，未命中的置 display:none。
 * （若用 v-for 直接过滤会把 DOM 项删掉，目录项数就不等于课程总数了，断言/行为都会背离原生版。） */
const visibleNos = computed(function () {
  const kw = keyword.value.trim().toLowerCase();
  const set = new Set();
  lessons.value.forEach(function (l) {
    const title = '第 ' + l.lessonNo + ' 课' + (l.lessonDate ? ' · ' + l.lessonDate : '');
    const hit = !kw || [title, l.summary, l.grammarPoint, l.level].join('  ').toLowerCase().indexOf(kw) !== -1;
    if (hit) { set.add(String(l.lessonNo)); }
  });
  return set;
});

const stageTitle = computed(function () {
  const l = curLesson.value;
  if (!l) { return ''; }
  return '第 ' + l.lessonNo + ' 课' + (l.lessonDate ? ' · ' + l.lessonDate : '');
});
const footCountText = computed(function () {
  if (!lessons.value.length) { return ''; }
  return '第 ' + (curIdx.value + 1) + ' / ' + lessons.value.length + ' 课';
});
const lessonCountText = computed(function () {
  return lessons.value.length ? ('共 ' + lessons.value.length + ' 课') : '';
});
const vocabCountText = computed(function () {
  const l = curLesson.value;
  if (!l) { return ''; }
  return (l.vocabCount || (l.vocabulary || []).length) + ' 个';
});

function fetchDetail(no) {
  if (cache[no]) { return Promise.resolve(cache[no]); }
  let hit = null;
  for (let i = 0; i < lessons.value.length; i += 1) {
    if (String(lessons.value[i].lessonNo) === String(no)) { hit = lessons.value[i]; break; }
  }
  if (!hit) { return Promise.reject(new Error('没有第 ' + no + ' 课的记录')); }
  /* exercises：F4-a 自查项期望来自 exercises[].selfCheck（后端尚未落库 → 空 list 走占位，不伪造） */
  return Promise.all([
    API.get('/lessons/' + hit.id),
    API.get('/lessons/' + hit.id + '/exercises').catch(function () { return null; })
  ]).then(function (r) {
    const lesson = r[0];
    const ex = r[1] && r[1].list ? r[1].list : [];
    if (ex.length) { lesson.exercises = ex; }
    cache[no] = lesson;
    return lesson;
  });
}

function showLesson(no) {
  for (let i = 0; i < lessons.value.length; i += 1) {
    if (String(lessons.value[i].lessonNo) === String(no)) { curIdx.value = i; break; }
  }
  loadingLesson.value = true;
  return fetchDetail(no).then(function (lesson) {
    curLesson.value = lesson;
    loadingLesson.value = false;
  }).catch(function (e) {
    curLesson.value = null;
    loadingLesson.value = false;
    emptyText.value = '课程加载失败：' + e.message;
    partError('课程详情', e);
  });
}

function loadLessons() {
  return API.lessonIndex().then(function (d) {
    lessons.value = (d.list || []).slice().sort(function (a, b) { return b.lessonNo - a.lessonNo; });
    if (!lessons.value.length) {
      emptyText.value = '暂无课程记录';
      return undefined;
    }
    return showLesson(lessons.value[0].lessonNo);   // 需求⑥：默认展示最新一课
  }).catch(function (e) {
    lessons.value = [];
    emptyText.value = '课程加载失败：' + e.message;
    partError('课程列表', e);
  });
}

function step(delta) {
  const next = curIdx.value + delta;
  if (next < 0 || next > lessons.value.length - 1) { return; }
  showLesson(lessons.value[next].lessonNo);
}

function loadAll() {
  errMsg.value = '';
  return Promise.all([loadStats(), loadLessons()]);
}

function onKeydown(e) {
  const tag = e.target && e.target.tagName;
  if (tag && /^(INPUT|TEXTAREA|SELECT)$/.test(tag)) { return; }
  if (e.key === 'ArrowLeft') { step(-1); }
  if (e.key === 'ArrowRight') { step(1); }
}

onMounted(function () {
  document.addEventListener('keydown', onKeydown);
  loadAll();
});
onBeforeUnmount(function () { document.removeEventListener('keydown', onKeydown); });
</script>

<template>
  <ApiErrorBar :msg="errMsg" @retry="loadAll" />

  <div class="board-top">
    <div class="board-main">
      <div class="stats">
        <div class="stat" v-for="s in stats" :key="s.id">
          <b :id="s.id" :class="{ pending: s.v === '…' }" :title="s.title || null">{{ s.v }}</b>
          <span>{{ s.label }}</span>
        </div>
      </div>
    </div>
  </div>

  <h2>课程<span class="count" id="lessonCount">{{ lessonCountText }}</span></h2>

  <!-- 需求⑥：阅读板块同构 —— 左侧目录（可搜索）+ 中间单课完整正文 + 上一课/下一课；默认最新一课 -->
  <div class="lesson-layout">
    <aside class="lesson-toc">
      <input id="q" v-model="keyword" placeholder="搜索课程总结与语法点">
      <nav class="ltoc-list" id="lessonList">
        <p v-if="!lessons.length" class="state loading">{{ emptyText || '正在加载课程…' }}</p>
        <button v-for="l in lessons" v-show="visibleNos.has(String(l.lessonNo))" :key="l.lessonNo"
          class="ltoc-item lesson" type="button"
          :class="{ on: String(l.lessonNo) === String(curLesson && curLesson.lessonNo) }"
          @click="showLesson(l.lessonNo)">
          <b>{{ '第 ' + l.lessonNo + ' 课' + (l.lessonDate ? ' · ' + l.lessonDate : '') }}</b>
          <span v-if="l.grammarPoint">{{ l.grammarPoint }}</span>
        </button>
      </nav>
    </aside>

    <section class="lesson-stage">
      <div class="stage-head">
        <h3 id="stageTitle">{{ stageTitle }}</h3>
        <p class="stage-meta" id="stageMeta"></p>
      </div>
      <div class="stage-body" id="stageBody">
        <p v-if="loadingLesson" class="state loading">正在加载课程…</p>
        <p v-else-if="!curLesson" class="state">{{ emptyText || '暂无课程记录' }}</p>
        <template v-else>
          <p class="sum">{{ curLesson.summary || '' }}</p>
          <p class="gp">{{ curLesson.grammarPoint ? ('语法点：' + curLesson.grammarPoint) : '' }}</p>
          <p class="meta">级别 {{ curLesson.level || '—' }}　生词 {{ curLesson.vocabCount || 0 }} 个　作业
            {{ curLesson.exerciseCount || 0 }} 项　错误 {{ curLesson.errorCount || 0 }} 处</p>
          <LessonSections :lesson="curLesson" :self-check-heading="false"
            :open-all="openAll" :deep-type="deepType" />
          <h4>本课词汇<span class="count">{{ vocabCountText }}</span></h4>
          <LessonVocab :list="curLesson.vocabulary || []" />
        </template>
      </div>
      <div class="stage-foot">
        <button class="pager" id="lsPrev" type="button" :disabled="curIdx <= 0" @click="step(-1)">← 上一课</button>
        <span class="pager-count" id="footCount">{{ footCountText }}</span>
        <button class="pager" id="lsNext" type="button" :disabled="curIdx >= lessons.length - 1" @click="step(1)">下一课 →</button>
      </div>
    </section>
  </div>

  <footer>提示：左侧切换课程（←/→ 同效），先回想再看正文核对。</footer>
</template>

<style scoped>
/* 首页布局（对内与原生 index.html 一一对应） */
.board-top { display: flex; align-items: flex-start; gap: 16px; }
.board-main { flex: 1 1 auto; min-width: 0; }
.board-main .stats { gap: 8px; margin: 14px 0 0; }
.board-main .stat { min-width: 0; flex: 0 0 auto; padding: 8px 12px; border-radius: 8px; }
.board-main .stat b { font-size: 18px; }
.board-main .stat span { font-size: 11px; }

.lesson-layout { display: flex; gap: 14px; margin-top: 6px; align-items: flex-start; }
.lesson-toc { width: 216px; flex: 0 0 auto; }
.lesson-toc #q { width: 100%; box-sizing: border-box; margin: 0 0 8px; }
.ltoc-list { display: flex; flex-direction: column; gap: 6px; max-height: 560px; overflow: auto; padding-right: 2px; }
.ltoc-item { display: block; width: 100%; box-sizing: border-box; text-align: left; background: #fff;
  border: 1px solid #e3e2dc; border-radius: 8px; padding: 7px 10px; cursor: pointer; font: inherit; }
.ltoc-item b { display: block; font-size: 13px; font-weight: 600; }
.ltoc-item span { display: block; color: #6b6b66; font-size: 11px; margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ltoc-item:hover { border-color: #b9c8d8; }
.ltoc-item.on { border-color: #185fa5; background: #eef4fb; }
.lesson-stage { flex: 1 1 auto; min-width: 0; }
/* 覆盖共享层：board.css 的 .stage-body 是阅读板块的横向 flex（左箭头+正文+右箭头），
   首页课程正文必须纵向堆叠，故显式改回 block（本组件 scoped 属性选择器优先级更高） */
.lesson-stage .stage-body { display: block; }
.stage-head h3 { margin: 0; font-size: 17px; }
.stage-foot { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.stage-body .gp { color: #3d3d38; font-size: 14px; margin: 4px 0 8px; }
.stage-body h4 { margin: 18px 0 6px; font-size: 14px; }
.stage-body :deep(table) { width: 100%; border-collapse: collapse; font-size: 13px; }
.stage-body :deep(th), .stage-body :deep(td) { border: 1px solid #e3e2dc; padding: 4px 8px; text-align: left; }

@media (max-width: 860px) {
  .lesson-layout { flex-direction: column; }
  .lesson-toc { width: auto; }
  .ltoc-list { max-height: 240px; }
}
</style>
