import path from 'path'
import { type Plugin } from 'vite'
import { MermaidConfig } from './type'

const DEFAULT_OPTIONS: MermaidConfig = {
  //We set loose as default here because is needed to load images
  securityLevel: 'loose',
  startOnLoad: false
}

export function MermaidPlugin(inlineOptions?: Partial<MermaidConfig>): Plugin {
  const options = {
    ...DEFAULT_OPTIONS,
    ...inlineOptions
  }

  const virtualModuleId = 'virtual:mermaid-config'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'vite-plugin-mermaid',
    enforce: 'post',

    transform(src, id) {
      //Register Mermaid component in vue instance creation
      if (id.includes('vitepress/dist/client/app/index.js')) {
        const MermaidComponentPath = path.resolve(__dirname, './Mermaid.vue')
        src = `\nimport Mermaid from '${MermaidComponentPath}';\n` + src
        src = src.replace(
          '// install global components',
          "// install global components\n\t\tapp.component('Mermaid', Mermaid);\n"
        )
        return {
          code: src,
          map: null // provide source map if available
        }
      }
    },

    async resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
    },
    async load(this, id) {
      if (id === resolvedVirtualModuleId) {
        return `export default ${JSON.stringify(options)};`
      }
    }
  }
}
