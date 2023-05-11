declare module 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs' {
  const initialize: (config: any) => void
  const render: (id: string, code: string) => Promise<{ svg: string }>
}

interface Window {
  mermaid: any
}
