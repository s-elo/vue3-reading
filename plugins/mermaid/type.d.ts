declare module 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs' {
  const Mermaid: {
    initialize: (config: any) => void
    render: (id: string, code: string) => Promise<{ svg: string }>
  }
  export default Mermaid
}

interface Window {
  mermaid: any
}
