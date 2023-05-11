import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'vue3-reading',
  description: 'source code reading of vue3',
  srcDir: 'src',
  base: '/vue3-reading/',
  head: [
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://gw.alipayobjects.com/os/k/font/lxgwwenkaiscreenr.css',
        as: 'font',
        async: 'true'
      }
    ]
  ],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Read', link: '/start' }
    ],

    sidebar: [
      {
        text: 'Usage Examples',
        collapsed: true,
        items: [
          {
            text: 'Markdown Examples',
            link: '/usage-examples/markdown-examples'
          },
          { text: 'Runtime API Examples', link: '/usage-examples/api-examples' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/s-elo/vue3-reading' }
    ]
  }
})
