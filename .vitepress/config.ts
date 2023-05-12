import { defineConfig, DefaultTheme } from 'vitepress'
import { withMermaid } from '../plugins/mermaid'

// https://vitepress.dev/reference/site-config
export default withMermaid(
  defineConfig({
    title: 'vue3-reading',
    description: 'source code reading of vue3',
    srcDir: 'src',
    base: '/vue3-reading/',
    lastUpdated: true,
    themeConfig: {
      // https://vitepress.dev/reference/default-theme-config
      nav: [
        { text: '准备', link: '/prepare/start', activeMatch: '/prepare/' },
        { text: '核心', link: '/core/start', activeMatch: '/core/' }
      ],

      sidebar: {
        '/prepare/': sidebarPrepare(),
        '/core/': sidebarCore()
      },

      socialLinks: [
        { icon: 'github', link: 'https://github.com/s-elo/vue3-reading' }
      ],

      editLink: {
        pattern: 'https://github.com/s-elo/vue3-reading/blob/master/src/:path',
        text: 'Edit this page on GitHub'
      }
    }
  })
)

function sidebarPrepare(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: '开始',
      collapsed: false,
      link: '/prepare/start'
    }
  ]
}

function sidebarCore(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: '渲染系统',
      collapsed: true,
      items: [{ text: '入口', link: '/core/start' }]
    }
  ]
}
