<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { API } from '../api.js';
import ApiErrorBar from '../components/ApiErrorBar.vue';
import LessonSections from '../components/LessonSections.vue';
import LessonVocab from '../components/LessonVocab.vue';
import { pageTitle } from '../stores/pageTitle.js';

/* 单课详情 · 参数化（/lesson/:no）—— 对应 review/lessons/lesson.html（2026-10-02 全站迁移）
 *
 * 映射：lessonNo → id 由 API.lessonIndex()（优先 /lessons/all，失败回退分页全量）建立
 * 详情：GET /api/lessons/:id（sections[] + vocabulary[]）+ /lessons/:id/exercises
 * 折叠：与首页课程区共用 LessonSections（桌面默认展开 语法/例句/作业/批改；支持 ?open=all 与 #sec-<type>）
 * F4-a：只读「提交前自查清单」，数据期望 exercises[].selfCheck —— 后端当前未返回（缺口），先占位。
 * F10：expectedMistakes 按 Amy 裁定不展示。
 */
const route = useRoute();

const errMsg = ref('');
const failText = ref('');
const lesson = ref(null);
const loading = ref(true);

const no = computed(function () { return route.params.no == null ? '' : String(route.params.no); });
const openAll = computed(function () { return String(route.query.open || '') === 'all'; });
const deepType = computed(function () { return (String(location.hash || '').match(/^#sec-(.+)$/) || [])[1] || ''; });
const vocabCountText = computed(function () {
  const l = lesson.value;
  if (!l) { return ''; }
  return (l.vocabCount || (l.vocabulary || []).length) + ' 个';
});

function errTextOf(e) {
  let msg = (e && e.message) || String(e);
  if (e && e.code === 0) { msg += '（请确认后端服务是否在运行）'; }
  return msg;
}
function partError(part, e) { errMsg.value = part + '加载失败：' + errTextOf(e); }

function fail(text) {
  failText.value = text;
  lesson.value = null;
  loading.value = false;
  pageTitle.value = '课程详情';
}

function loadAll() {
  errMsg.value = '';
  if (!no.value) { fail('缺少课号参数（正确用法：/lesson/6）'); return Promise.resolve(); }
  loading.value = true;
  failText.value = '';
  // lessonNo → id 映射：优先 /lessons/all，失败回退分页全量（API.lessonIndex 内部处理）
  return API.lessonIndex().then(function (d) {
    let hit = null;
    for (let i = 0; i < d.list.length; i += 1) {
      if (String(d.list[i].lessonNo) === no.value) { hit = d.list[i]; break; }
    }
    if (!hit) { fail('没有第 ' + no.value + ' 课的记录（库内共 ' + d.total + ' 课）'); return undefined; }
    // 同时拉练习明细：F4-a 自查项期望来自 exercises[].selfCheck（该字段后端尚未落库，
    // 一旦补上即自动生效；此刻返回空 list，走占位，不伪造）
    return Promise.all([
      API.get('/lessons/' + hit.id),
      API.get('/lessons/' + hit.id + '/exercises').catch(function () { return null; })
    ]).then(function (r) {
      const l = r[0];
      const ex = r[1] && r[1].list ? r[1].list : [];
      if (ex.length) { l.exercises = ex; }
      lesson.value = l;
      loading.value = false;
      pageTitle.value = '第 ' + l.lessonNo + ' 课 · ' + (l.lessonDate || '');
      document.title = '第 ' + l.lessonNo + ' 课';
    });
  }).catch(function (e) {
    loading.value = false;
    partError('课程详情', e);
  });
}

/* 路由参数变化（切课号 / 前进后退）→ 重新加载 */
watch(no, function () { loadAll(); });

onMounted(loadAll);
</script>

<template>
  <ApiErrorBar :msg="errMsg" @retry="loadAll" />

  <div id="lessonBody">
    <p v-if="loading" class="state loading">正在加载课程…</p>
    <p v-else-if="failText" class="state">{{ failText }}</p>
    <template v-else-if="lesson">
      <p class="sub">{{ lesson.summary || '' }}</p>
      <p class="gp">语法点：{{ lesson.grammarPoint || '—' }}</p>
      <p class="meta">级别 {{ lesson.level || '—' }}　生词 {{ lesson.vocabCount || 0 }} 个　作业
        {{ lesson.exerciseCount || 0 }} 项　错误 {{ lesson.errorCount || 0 }} 处</p>

      <LessonSections :lesson="lesson" :self-check-heading="true"
        :open-all="openAll" :deep-type="deepType" />

      <h2>本课词汇<span class="count">{{ vocabCountText }}</span></h2>
      <LessonVocab :list="lesson.vocabulary || []" />
    </template>
  </div>

  <footer>提示：小节正文以库内数据为准；标注「未入库」的小节表示该小节正文尚未进入数据库。</footer>
</template>

<style scoped>
.lesson-head .meta, #lessonBody .meta { color: #6b6b66; font-size: 12px; margin: 4px 0 8px; }
#lessonBody .gp { color: #3d3d38; font-size: 14px; margin: 4px 0 8px; }
#lessonBody :deep(table) { width: 100%; border-collapse: collapse; font-size: 13px; }
#lessonBody :deep(th), #lessonBody :deep(td) { border: 1px solid #e3e2dc; padding: 4px 8px; text-align: left; }
</style>
