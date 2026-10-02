<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { API } from '../api.js';
import ApiErrorBar from '../components/ApiErrorBar.vue';

/* 阅读页 · API 驱动 —— 对应 review/reading.html（2026-10-02 全站迁移）
 *
 * 日期清单：GET /api/readings（倒序，首条即最新一天）
 * 今日状态：GET /api/readings/stats（F8「今天是否已生成」可见 —— 硬要求，不可回退）
 * 当天全文：GET /api/readings/:date（段落级英中对照 + 生词注释 + 理解题）
 *
 * 交互口径：选定某天后**一次只显示当天的一篇**；左侧箭头 / 底部「上一篇·下一篇」/ 键盘 ←→
 *          三路同步，均按**篇序号**翻页。
 * 深链：原生用 `#<date>`，Vue 版改路径参数 `/reading/<date>`（可刷新、可分享直达，能力等价）。
 * 答案缺失口径（ai-teacher.md §11.10）：`answer` 为空属**数据缺陷**，不得渲染成功能 ——
 *          不出「看答案」按钮、中性缺陷提示、console.warn + 登记 window.__readingDefects。
 */
const route = useRoute();
const router = useRouter();

const errMsg = ref('');
const dayList = ref([]);               // GET /readings 的原始清单项（含 pieceCount），倒序
const dates = computed(function () { return dayList.value.map(function (x) { return x.date; }); });
const cache = reactive({});            // date -> { sourceFile, pieces }（已归一化，含 idx/zhShown/questions[].hasAnswer）
const curDate = ref('');
const curIdx = ref(0);
const todayNote = ref({ show: false, cls: 'f8note hide', text: '' });

const ANS_KEY = 'reading-answers';
const answers = reactive({});

const pieces = computed(function () {
  const day = cache[curDate.value];
  return (day && day.pieces) || [];
});
const curPiece = computed(function () { return pieces.value[curIdx.value] || null; });
const countText = computed(function () {
  const n = pieces.value.length;
  return n ? ('第 ' + (curIdx.value + 1) + ' / ' + n + ' 篇') : '';
});
const fileText = computed(function () {
  const f = cache[curDate.value] && cache[curDate.value].sourceFile;
  return f ? ('read\\' + f) : '';
});
const footText = computed(function () {
  const n = pieces.value.length;
  if (n <= 1) { return ''; }
  return countText.value + ' ｜ ' + ((curPiece.value && curPiece.value.title) || '');
});
const atFirst = computed(function () { return curIdx.value <= 0; });
const atLast = computed(function () { return curIdx.value >= pieces.value.length - 1; });

function errTextOf(e) {
  let msg = (e && e.message) || String(e);
  if (e && e.code === 0) { msg += '（请确认后端服务是否在运行）'; }
  return msg;
}
function partError(part, e) { errMsg.value = part + '加载失败：' + errTextOf(e); }

/* ---------- 理解题作答：仅存本机（本期不落库） ---------- */
function loadAnswers() {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(ANS_KEY) || '{}') || {}; } catch (e) { all = {}; }
  Object.keys(answers).forEach(function (k) { delete answers[k]; });
  Object.keys(all).forEach(function (k) { answers[k] = all[k]; });
}
function saveAnswer(key, val) {
  if (val) { answers[key] = val; } else { delete answers[key]; }
  const plain = {};
  Object.keys(answers).forEach(function (k) { plain[k] = answers[k]; });
  try { localStorage.setItem(ANS_KEY, JSON.stringify(plain)); } catch (e) { /* 隐私模式等，静默忽略 */ }
}
function ansKey(date, pieceNo, questionNo) {
  return date + '#' + (pieceNo == null ? '' : pieceNo) + '#' + (questionNo == null ? '' : questionNo);
}

/* ---------- 缺陷登记（§11.10）---------- */
const seenMissing = {};
const missingAnswers = [];
function noteMissingAnswer(date, pieceNo, questionNo) {
  const k = ansKey(date, pieceNo, questionNo);
  if (seenMissing[k]) { return; }        // 同一次页面会话内同一缺陷只报一次
  seenMissing[k] = true;
  const info = { date: date, pieceNo: pieceNo == null ? null : pieceNo, questionNo: questionNo == null ? null : questionNo };
  missingAnswers.push(info);
  try { window.__readingDefects = missingAnswers; } catch (e) { /* 忽略 */ }
  if (window.console && window.console.warn) {
    window.console.warn('[reading] 理解题参考答案缺失（数据缺陷，非功能）', info);
  }
}

/* ---------- 归一化：把接口数据整理成模板可直接渲染的结构 ---------- */
function normalize(day, date) {
  const list = (day.pieces || []).map(function (p, i) {
    const paras = p.paragraphs || [];
    const questions = (p.questions || []).map(function (q) {
      const ok = typeof q.answer === 'string' && q.answer.trim() !== '';
      if (!ok) { noteMissingAnswer(date, p.pieceNo, q.questionNo); }
      return { questionNo: q.questionNo, question: q.question, answer: q.answer, hasAnswer: ok };
    });
    return {
      idx: i,
      pieceNo: p.pieceNo,
      title: p.title,
      levelCode: p.levelCode,
      source: p.source,
      wordCount: p.wordCount,
      paragraphs: paras,
      vocabularyNotes: p.vocabularyNotes,
      questions: questions,
      hasZh: paras.some(function (x) { return !!x.zh; }),
      zhShown: false
    };
  });
  day.pieces = list;
  return day;
}

/* ---------- F8：今日是否已生成（硬要求） ---------- */
function setTodayNote(stats) {
  if (!stats) { todayNote.value = { show: false, cls: 'f8note hide', text: '' }; return; }
  const today = stats.today || '';
  if (today && stats.lastReadDate === today) {
    todayNote.value = { show: true, cls: 'f8note ok', text: '今日阅读已生成（' + today + '）' };
  } else {
    todayNote.value = {
      show: true, cls: 'f8note miss',
      text: '今日阅读尚未生成' + (stats.lastReadDate ? '，最近一次：' + stats.lastReadDate : '')
    };
  }
}

function fetchDay(date) {
  if (cache[date]) { return Promise.resolve(cache[date]); }
  return API.get('/readings/' + encodeURIComponent(date)).then(function (d) {
    cache[date] = normalize(d || {}, date);
    return cache[date];
  });
}

function scrollToStage() {
  const stage = document.querySelector('.reading-stage');
  if (stage && stage.scrollIntoView) { stage.scrollIntoView({ block: 'start' }); }
}

function showDay(date) {
  if (dates.value.indexOf(date) === -1) { date = dates.value[0]; }
  if (!date) { return Promise.resolve(); }
  curDate.value = date;
  curIdx.value = 0;
  if (String(route.params.date || '') !== String(date)) {
    router.replace('/reading/' + encodeURIComponent(date));
  }
  if (cache[date]) { return Promise.resolve(cache[date]); }
  return fetchDay(date).catch(function (e) {
    errMsg.value = '';
    partError('阅读正文', e);
  });
}

function step(delta) {
  const next = curIdx.value + delta;
  if (next < 0 || next > pieces.value.length - 1) { return; }
  curIdx.value = next;
  scrollToStage();
}

function toggleZh(p) {
  p.zhShown = !p.zhShown;
}

function onKeydown(e) {
  const tag = e.target && e.target.tagName;
  if (tag && /^(INPUT|TEXTAREA|SELECT)$/.test(tag)) { return; }
  if (e.key === 'ArrowLeft') { step(-1); }
  if (e.key === 'ArrowRight') { step(1); }
}

/* ---------- 启动 ---------- */
function boot() {
  errMsg.value = '';
  loadAnswers();
  return Promise.all([
    API.getPage('/readings', 1, 200),
    API.get('/readings/stats').catch(function () { return null; })
  ]).then(function (res) {
    const d = res[0] || {};
    const list = d.list || [];
    dayList.value = list;
    setTodayNote(res[1]);
    if (!dates.value.length) { curDate.value = ''; return undefined; }
    const want = String(route.params.date || '');
    return showDay(dates.value.indexOf(want) !== -1 ? want : dates.value[0]);
  }).catch(function (e) {
    dayList.value = [];
    partError('阅读目录', e);
  });
}

/* 浏览器前进/后退（路由变化）→ 切天 */
watch(function () { return route.params.date; }, function (v) {
  const want = String(v || '');
  if (want && dates.value.indexOf(want) !== -1 && want !== curDate.value) { showDay(want).then(scrollToStage); }
});

onMounted(function () {
  document.addEventListener('keydown', onKeydown);
  boot();
});
onBeforeUnmount(function () { document.removeEventListener('keydown', onKeydown); });
</script>

<template>
  <p class="sub">左侧选择日期，中间「一次只显示一篇」；点右侧箭头或下方「下一篇」看下一篇，点左侧箭头或「上一篇」回到上一篇（键盘 ←/→ 同效）。</p>

  <ApiErrorBar :msg="errMsg" @retry="boot" />

  <div class="reading-layout">
    <aside class="reading-toc">
      <div class="rtoc-title">阅读目录</div>
      <nav class="rtoc-list" id="tocList">
        <p v-if="!dates.length" class="state loading">正在加载目录…</p>
        <button v-for="x in dayList" :key="x.date" class="rtoc-item" type="button" :class="{ on: x.date === curDate }"
          @click="showDay(x.date).then(scrollToStage)">
          <b>{{ x.date }}</b>
          <span>{{ x.pieceCount || 0 }} 篇</span>
        </button>
      </nav>
    </aside>

    <section class="reading-stage">
      <div class="stage-head">
        <h2 id="stageDate">{{ curDate }}</h2>
        <span class="stage-count" id="stageCount">{{ countText }}</span>
      </div>
      <p class="stage-file" id="stageFile">{{ fileText }}</p>
      <p v-show="todayNote.show" :class="todayNote.cls" id="todayNote">{{ todayNote.text }}</p>

      <div class="stage-body">
        <button class="navbtn" id="navPrev" type="button" aria-label="上一篇" title="上一篇（←）"
          :disabled="atFirst" @click="step(-1)">&#8592;</button>
        <div class="stage-viewport" id="stageViewport">
          <p v-if="!curDate" class="state">还没有阅读内容</p>
          <p v-else-if="!pieces.length" class="state">这一天还没有阅读内容</p>
          <template v-else>
            <article v-for="p in pieces" :key="p.idx" v-show="p.idx === curIdx" class="card rcard"
              :data-date="curDate" :data-idx="p.idx">
              <h3>第 {{ p.pieceNo == null ? '' : p.pieceNo }} 篇 · {{ p.title || '未命名' }}</h3>
              <p class="meta">级别：{{ p.levelCode || '未标注' }} ｜ 来源：{{ p.source || '未标注' }}<template
                  v-if="p.wordCount"> ｜ {{ p.wordCount }} 词</template></p>
              <button v-if="p.hasZh" class="zhbtn" type="button" @click="toggleZh(p)">{{ p.zhShown ? '收起中文' : '整篇看中文' }}</button>
              <button v-else class="zhbtn" type="button" disabled title="本篇没有中文对照">整篇看中文</button>
              <div class="pairs">
                <template v-for="(x, i) in p.paragraphs" :key="i">
                  <p class="en">{{ x.en }}</p>
                  <p v-if="x.zh" class="zh" :hidden="!p.zhShown">{{ x.zh }}</p>
                </template>
              </div>
              <template v-if="p.vocabularyNotes">
                <h4>生词注释</h4>
                <p class="vnotes">{{ p.vocabularyNotes }}</p>
              </template>
              <template v-if="p.questions.length">
                <h4>理解题</h4>
                <div v-for="q in p.questions" :key="q.questionNo" class="qitem">
                  <p class="qtext">{{ (q.questionNo ? q.questionNo + '. ' : '') + (q.question || '') }}</p>
                  <textarea class="qans" rows="2" :data-key="ansKey(curDate, p.pieceNo, q.questionNo)"
                    placeholder="先写你的答案，再展开对照" :value="answers[ansKey(curDate, p.pieceNo, q.questionNo)] || ''"
                    @input="saveAnswer(ansKey(curDate, p.pieceNo, q.questionNo), $event.target.value)"></textarea>
                  <div class="qfoot">
                    <details v-if="q.hasAnswer" class="qbox">
                      <summary>看答案</summary>
                      <div class="qansbox">{{ q.answer }}</div>
                    </details>
                    <!-- §11.10：answer 空＝数据缺陷 → 不出「看答案」按钮，用中性缺陷提示（禁写「暂无答案」） -->
                    <span v-else class="qnoans">参考答案缺失（数据异常，已记录）</span>
                    <span class="qhint">作答只存本机</span>
                  </div>
                </div>
              </template>
            </article>
          </template>
        </div>
        <button class="navbtn" id="navNext" type="button" aria-label="下一篇" title="下一篇（→）"
          :disabled="atLast" @click="step(1)">&#8594;</button>
      </div>

      <div class="stage-foot" id="stageFoot">
        <button class="pager" id="navPrev2" type="button" :disabled="atFirst" @click="step(-1)">← 上一篇</button>
        <span class="pager-count" id="footCount">{{ footText }}</span>
        <button class="pager" id="navNext2" type="button" :disabled="atLast" @click="step(1)">下一篇 →</button>
      </div>
    </section>
  </div>

  <footer>提示：先自己读一遍，再点「整篇看中文」核对；理解题先作答，再展开对照答案（作答只存本机）。</footer>
</template>
