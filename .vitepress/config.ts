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
      },

      search: {
        // provider: 'algolia',
        // options: {
        //   appId: 'YUV9XZGZGY',
        //   apiKey: '6ac59918772dd0245cac43e636827a12',
        //   indexName: 'vue3-reading'
        // }
        provider: 'local'
      }
    },
    markdown: {
      lineNumbers: true
    }
  })
)

function sidebarPrepare(): DefaultTheme.SidebarItem[] {
  return [
    { text: '开始', link: '/prepare/start' },
    {
      text: '前置知识',
      collapsed: true,
      items: [
        { text: 'Typescript', link: '/prepare/pre-knowledge/ts' },
        { text: 'JS Set和Map', link: '/prepare/pre-knowledge/data-structure' },
        { text: 'JS Proxy 代理对象', link: '/prepare/pre-knowledge/proxy' },
        { text: '测试-Spec', link: '/prepare/pre-knowledge/spec' }
      ]
    },
    {
      text: '仓库分析',
      collapsed: false,
      items: [
        { text: '整体介绍', link: '/prepare/repository/overview' },
        { text: '开发', link: '/prepare/repository/dev' },
        { text: '生产打包', link: '/prepare/repository/build' }
      ]
    }
  ]
}

function sidebarCore(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: '渲染系统',
      collapsed: false,
      items: [{ text: '入口', link: '/core/start' }]
    }
  ]
}
