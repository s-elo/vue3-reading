import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs'

export const render = async (
  id: string,
  code: string,
  config: any
): Promise<string> => {
  mermaid.initialize(config)

  const { svg } = await mermaid.render(id, code)

  return svg
}
