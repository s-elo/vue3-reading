let mermaid:
  | undefined
  | typeof import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs').default

export const render = async (
  id: string,
  code: string,
  config: any
): Promise<string> => {
  if (!mermaid) {
    mermaid = (
      await import(
        'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs'
      )
    ).default
  }
  console.log(mermaid)
  mermaid.initialize(config)

  const { svg } = await mermaid.render(id, code)

  return svg
}
