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
    head: [
      [
        'link',
        {
          href: 'https://vuejs.org/images/logo.png',
          rel: 'icon'
        }
      ],
      [
        'meta',
        {
          name: 'google-site-verification',
          content: 'qd_Z8UuWw83sTtVbiYfZRxjth5hHNgG0n9aYOfs82Ds'
        }
      ]
    ],
    themeConfig: {
      // https://vitepress.dev/reference/default-theme-config
      nav: [
        { text: '准备', link: '/prepare/start', activeMatch: '/prepare/' },
        {
          text: '核心',
          link: '/core/reactivity/reactive',
          activeMatch: '/core/'
        }
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
        provider: 'algolia',
        options: {
          appId: '6LTKEEIWRI',
          apiKey: '53c282e3ed19be3da3d168322e280ad0',
          indexName: 'vue3-reading'
        }
      },

      logo: 'https://vuejs.org/images/logo.png',

      outline: [2, 6]
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
        { text: '生产打包', link: '/prepare/repository/build' },
        { text: '测试', link: '/prepare/repository/test' },
        { text: '发包', link: '/prepare/repository/publish' },
        { text: '代码规范', link: '/prepare/repository/convention' }
      ]
    }
  ]
}

function sidebarCore(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: '响应式系统',
      collapsed: false,
      items: [
        {
          text: 'reactive',
          link: '/core/reactivity/reactive'
        }
      ]
    },
    {
      text: '渲染系统',
      collapsed: false,
      items: [{ text: '入口', link: '/core/start' }]
    }
  ]
}
