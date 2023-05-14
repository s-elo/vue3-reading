<template>
  <div :class="`mermaid-container ${isZoomIn ? 'float' : ''}`" @click="isZoomIn = true">
    <div v-html="svg"></div>
  </div>
  <Modal v-model="isZoomIn" :close-by-click-background="true">
    <div class="larger-mermaid-container" @click="isZoomIn = false" v-if="isZoomIn">
      <div v-html="svg"></div>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import { render } from './mermaid'
import { useData } from 'vitepress'
import Modal from '../../components/Modal.vue'
import { MermaidConfig } from './type'

const pluginSettings = ref<MermaidConfig>({
  securityLevel: 'loose',
  startOnLoad: false
})
const { page } = useData()
const { frontmatter } = toRaw(page.value)
const mermaidPageTheme = frontmatter.mermaidTheme || ''

const props = defineProps({
  graph: {
    type: String,
    required: true
  },
  id: {
    type: String,
    required: true
  }
})

// render when markdown file changed
watch(props, () => {
  renderChart()
})

const isZoomIn = ref(false)
const svg = ref<string | null>(null)
let mut: MutationObserver | null = null

const renderChart = async () => {
  const hasDarkClass = document.documentElement.classList.contains('dark')
  const mermaidConfig = {
    ...pluginSettings.value
  }

  if (mermaidPageTheme) mermaidConfig.theme = mermaidPageTheme
  if (hasDarkClass) mermaidConfig.theme = 'dark'

  const svgCode = await render(
    props.id,
    decodeURIComponent(props.graph),
    mermaidConfig
  )
  // This is a hack to force v-html to re-render, otherwise the diagram disappears
  // when **switching themes** or **reloading the page**.
  // The cause is that the diagram is deleted during rendering (out of Vue's knowledge).
  // Because svgCode does NOT change, v-html does not re-render.
  // This is not required for all diagrams, but it is required for c4c, mindmap and zenuml.
  const salt = Math.random().toString(36).substring(7)
  svg.value = `${svgCode} <span style="display: none">${salt}</span>`
}

onMounted(async () => {
  const settings = await import('virtual:mermaid-config')
  if (settings?.default) pluginSettings.value = settings.default

  mut = new MutationObserver(() => renderChart())
  mut.observe(document.documentElement, { attributes: true })
  await renderChart()

  //refresh images on first render
  const hasImages =
    (/<img([\w\W]+?)>/.exec(decodeURIComponent(props.graph))?.length ?? 0) > 0
  if (hasImages)
    setTimeout(() => {
      const imgElements = document.getElementsByTagName('img')
      const imgs = Array.from(imgElements)
      if (imgs.length) {
        Promise.all(
          imgs
            .filter(img => !img.complete)
            .map(
              img =>
                new Promise(resolve => {
                  img.onload = img.onerror = resolve
                })
            )
        ).then(() => {
          renderChart()
        })
      }
    }, 100)
})

onUnmounted(() => mut?.disconnect())
</script>

<style scoped lang="scss">
.mermaid-container {
  width: 100%;
  cursor: zoom-in;
  background-color: #fff;
}
.larger-mermaid-container {
  width: 80vw;
  cursor: zoom-out;
}
</style>
