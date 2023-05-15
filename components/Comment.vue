<script lang="ts" setup>
import { onMounted } from 'vue'

const loadComment = () => {
  const isDark = document.documentElement.classList.contains('dark')

  const scriptDom = document.createElement('script')
  const utterancesConfig = {
    src: 'https://utteranc.es/client.js',
    repo: 's-elo/vue3-reading',
    'issue-term': 'pathname',
    label: 'Comment',
    theme: isDark ? 'github-dark' : 'github-light',
    crossorigin: 'anonymous'
  }

  for (const config of Object.keys(utterancesConfig)) {
    scriptDom.setAttribute(config, utterancesConfig[config])
  }

  const commentContainer = document.getElementById('utterances')
  if (!commentContainer) return

  commentContainer.append(scriptDom)

  scriptDom.addEventListener('load', () => {
    if (commentContainer.children.length <= 1) return

    const originalComment = commentContainer.firstElementChild
    if (!originalComment) return

    commentContainer.removeChild(originalComment)
  })
}

onMounted(() => {
  loadComment()
  const observer = new MutationObserver(() => loadComment())
  observer.observe(document.documentElement, { attributes: true })
})
</script>
<template>
  <div id="utterances"></div>
</template>
<style scoped lang="scss"></style>
