<script setup>
/* 本课词汇表（对应 UI.renderVocab；index 与 lesson 两处共用）
 * 列：单词（新词带 tag）/ 音标 / 中文 / 例句
 */
defineProps({ list: { type: Array, default: () => [] } });
</script>

<template>
  <p v-if="!list.length" class="state">本课暂无词汇记录</p>
  <table v-else>
    <thead>
      <tr><th>单词</th><th>音标</th><th>中文</th><th>例句</th></tr>
    </thead>
    <tbody>
      <tr v-for="(v, i) in list" :key="i">
        <td>{{ v.word }}<template v-if="v.isNew"> <span class="tag">新</span></template></td>
        <td>{{ v.phonetic || '' }}</td>
        <td>{{ v.meaning || '' }}</td>
        <td>{{ v.example || '' }}</td>
      </tr>
    </tbody>
  </table>
</template>
