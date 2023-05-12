declare module 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs' {
  const Mermaid: {
    initialize: (config: any) => void
    render: (id: string, code: string) => Promise<{ svg: string }>
  }
  export default Mermaid
}

declare module 'virtual:mermaid-config' {
  const pluginSettings: {
    theme?: string
    themeVariables?: any
    themeCSS?: string
    maxTextSize?: number
    darkMode?: boolean
    htmlLabels?: boolean
    fontFamily?: string
    altFontFamily?: string
    logLevel?: number
    securityLevel?: string
    startOnLoad?: boolean
    arrowMarkerAbsolute?: boolean
    secure?: string[]
    deterministicIds?: boolean
    deterministicIDSeed?: string
  }

  export default pluginSettings
}

interface Window {
  mermaid: any
}
