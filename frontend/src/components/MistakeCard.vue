<script setup>
import { computed } from 'vue';
import { label } from '../utils/labels.js';

/* 错词卡（对应 UI.mistakeCard + UI.streakBar）
 * F2 四项硬指标：累计犯错次数（wrongCount）/ 连续答对进度条（streak，2 次过关）/ priority / errorType
 *               + 来源课号（无来源显示「诊断」）。全部取值来自接口，前端不推导。
 * data-status / data-type / data-text 三个属性供筛选与搜索用（与原生版同口径，便于断言等价）。
 */
const props = defineProps({ m: { type: Object, required: true } });

const passed = computed(() => props.m.status === 'passed');
const src = computed(() => (props.m.firstLessonNo ? ('第 ' + props.m.firstLessonNo + ' 课') : '诊断'));
const searchText = computed(() => [props.m.wrongText, props.m.correctText, props.m.errorReason, src.value]
  .join('  ').toLowerCase());

const streakTarget = 2;
const streakCur = computed(() => Math.max(0, Math.min(streakTarget, Number(props.m.streak) || 0)));
const streakPct = computed(() => Math.round((streakCur.value / streakTarget) * 100));
const streakText = computed(() => (passed.value ? '已过关' : ('连续答对 ' + streakCur.value + ' / ' + streakTarget)));
</script>

<template>
  <article class="card mcard" :class="{ 'passed-item': passed }" :data-status="m.status || ''"
    :data-type="m.errorType || ''" :data-text="searchText">
    <div class="top">
      <span class="wrong">{{ m.wrongText || '' }}</span>
      <span class="arrow">→</span>
      <span class="right">{{ m.correctText || '' }}</span>
    </div>
    <div class="metrics">
      <span class="tag" title="累计犯错次数">第 {{ m.wrongCount || 0 }} 次犯</span>
      <span class="tag" :class="m.priority ? ('priority-' + m.priority) : ''">{{ label('priority', m.priority) }}</span>
      <span class="tag">{{ label('errorType', m.errorType) }}</span>
      <span class="tag">来源 {{ src }}</span>
      <span class="tag" :class="{ passed: passed }">{{ label('status', m.status) }}</span>
    </div>
    <div class="metrics">
      <span class="streak" title="连续答对 2 次即过关">
        <span class="bar"><i :class="{ full: streakCur >= streakTarget }" :style="{ width: streakPct + '%' }"></i></span>
        <span>{{ streakText }}</span>
      </span>
    </div>
    <p class="why">{{ m.errorReason || '' }}</p>
  </article>
</template>
