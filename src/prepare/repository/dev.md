这篇文章主要阅读开发需要用到的命令和工具，即以下脚本涉及的部分。

```json
{
  "dev": "node scripts/dev.js",
  "dev-esm": "node scripts/dev.js -if esm-bundler-runtime",
  "dev-compiler": "run-p \"dev template-explorer\" serve",
  "dev-sfc": "run-s dev-sfc-prepare dev-sfc-run",
  "dev-sfc-prepare": "node scripts/pre-dev-sfc.js || npm run build-compiler-cjs",
  "dev-sfc-serve": "vite packages/sfc-playground --host",
  "dev-sfc-run": "run-p \"dev compiler-sfc -f esm-browser\" \"dev vue -if esm-bundler-runtime\" \"dev server-renderer -if esm-bundler\" dev-sfc-serve",
  "serve": "serve",
  "open": "open http://localhost:5000/packages/template-explorer/local.html"
}
```

首先我们会了解这些命令所涉及在 scripts/\*里的脚本，接着在逐一分析每个命令所做的事情。

## 相关脚本

从以上命令可以看到涉及的脚本主要有两个：`dev.js` 和 `pre-dev-sfc.js`。

### [dev.js](https://github.com/vuejs/core/blob/main/scripts/dev.js)

此脚本主要是通过[esbuild](https://esbuild.github.io/)对要开发的包进行监听打包，修改即 rebuild。

::: details 为什么只有在开发时才用 esbuild？
我们知道 esbuild 是通过`Go`编写的，可以直接使用编译后的打包代码进行打包处理，所以速度非常快，可以有更好的开发体验。但是 rollup 打包出来的体积更小，且有更好的[tree-shaking](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking)，所以在生产环境的打包工具选择 rollup 而不是 esbuild。
:::

#### 使用

在执行脚本时，直接提供要打包的包名(精准匹配)即可。e.g. `node scripts/dev.js runtime-dom`。包名默认为`vue`

此外还可以提供以下参数，脚本是通过[minimist](https://www.npmjs.com/package/minimist)处理参数的。

- `-f`: 指定打包的格式，包括`global`, `esm-bundler`, `esm-browser`, `cjs`以及`vue`包额外的格式`global-runtime`, `esm-bundler-runtime`, `esm-browser-runtime`；默认`global`；具体每种格式的含义在分析[打包](./build)相关命令脚本时再展开。
- `-i`: (inline)是否将依赖包一起打包进去；不提供即 `false`；为`false`时对`cjs`和`esm-bundler(-runtime)`格式会 external 掉所有的依赖包。

```bash
$ node scripts/dev.js runtime-dom -if esm-bundler
# 包名的位置并不要紧
$ node scripts/dev.js -f cjs runtime-dom
```

#### 实现

具体的脚本代码并不多，主要是明确 esbuild 的配置，接着调用 esbuild 提供的 api 即可。

其中有几点特殊处理的情况：

- `vue-compat`包打包的文件`target`名是`vue`而不是其本身。
  ```js
  const outfile = resolve(
  __dirname,
  `../packages/${target}/dist/${
    target === 'vue-compat' ? `vue` : target
  }.${postfix}.js`
  ```
- 在处理`externals`(打包时不包含的依赖包)时，`compiler-sfc`包需要额外 external 掉`@vue/consolidate`里的依赖包(**devDependencies**)，但包含`@vue/consolidate`包本身(打包格式不是`cjs`和`esm-bundler(-runtime)`格式时)。

### pre-dev-sfc.js
