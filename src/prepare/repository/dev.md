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

最后通过`pnpm link`(或者其他包管理工具)进行本地 link 调试。

```bash
# /Users/xxx/xxx/vue-core/packages/vue
$ pnpm dev vue -if esm-bundler

# 在用于调试的项目根目录下 e.g. /Users/xxx/xxx/my-project/
$ pnpm link /Users/xxx/xxx/vue-core/packages/vue

# /Users/xxx/xxx/my-project/下unlink
$ pnpm unlink /Users/xxx/xxx/vue-core/packages/vue
```

这样`vue`包下的代码的改动就可以实时地体现在调试项目中了。

::: tip 开发时打包的注意点

- 在`pnpm link`之前，我们需要明确要开发的包的打包方式。比如上面例子我们是`esm-bundler`&&`inline`(所有其他依赖包一起打包进来了)的方式打包的。
  那么我们在用于调试的项目中需要使用 esm 模块的方式且只需要安装`vue`即可，无需处理其他的依赖包比如`runtime-dom`等。
- 在开发某个包之前，请确保已经通过`pnpm build`将其他依赖包打包好，因为在引入依赖包时都会根据以下在`package.json`的配置寻找对应的入口文件。
  :::

##### 引包规则

在`package.json`中指定的入口文件如下所示：

::: details 部分 package.json

```json
{
  "main": "index.js",
  "module": "dist/vue.runtime.esm-bundler.js",
  "types": "dist/vue.d.ts",
  "unpkg": "dist/vue.global.js",
  "jsdelivr": "dist/vue.global.js",
  "files": [
    "index.js",
    "index.mjs",
    "dist",
    "compiler-sfc",
    "server-renderer",
    "jsx-runtime",
    "jsx.d.ts",
    "macros.d.ts",
    "macros-global.d.ts",
    "ref-macros.d.ts"
  ],
  "exports": {
    ".": {
      "types": "./dist/vue.d.ts",
      "import": {
        "node": "./index.mjs",
        "default": "./dist/vue.runtime.esm-bundler.js"
      },
      "require": "./index.js"
    },
    "./server-renderer": {
      "types": "./server-renderer/index.d.ts",
      "import": "./server-renderer/index.mjs",
      "require": "./server-renderer/index.js"
    },
    "./compiler-sfc": {
      "types": "./compiler-sfc/index.d.ts",
      "import": "./compiler-sfc/index.mjs",
      "require": "./compiler-sfc/index.js"
    },
    "./jsx-runtime": {
      "types": "./jsx-runtime/index.d.ts",
      "import": "./jsx-runtime/index.mjs",
      "require": "./jsx-runtime/index.js"
    },
    "./jsx-dev-runtime": {
      "types": "./jsx-runtime/index.d.ts",
      "import": "./jsx-runtime/index.mjs",
      "require": "./jsx-runtime/index.js"
    },
    "./jsx": "./jsx.d.ts",
    "./dist/*": "./dist/*",
    "./package.json": "./package.json",
    "./macros": "./macros.d.ts",
    "./macros-global": "./macros-global.d.ts",
    "./ref-macros": "./ref-macros.d.ts"
  }
}
```

:::

- **main**: 指定`cjs`方式引入时对应的入口文件，值为`index.js`。
  ::: details index.js
  `main`指定的`index.js`里实际引入的就是打包好后的`vue.cjs.(prod).js`文件。因此我们需要确保`dist`目录下有对应的`vue.cjs.(prod).js`文件。

  ```js
  // index.js 文件内容
  'use strict'

  if (process.env.NODE_ENV === 'production') {
    module.exports = require('./dist/vue.cjs.prod.js')
  } else {
    module.exports = require('./dist/vue.cjs.js')
  }
  ```

  :::

- **module**: 指定`esm`模块方式引入时对应的入口文件，值为`dist/vue.runtime.esm-bundler.js`。
- **unpkg**: 这是一个为了支持[UNPKG](https://unpkg.com/)的 CDN 而使用的，可以看到其指定的文件就是通过[iife](https://en.wikipedia.org/wiki/Immediately_invoked_function_expression)的方式打包的`dist/vue.global.js`；这样只要上传到了 npm，我们就可以通过`unpkg.com/:package@:version/:file`(e.g. https://unpkg.com/@vue/runtime-dom)的方式通过CDN去获取对应包的资源了。不过这里为啥不用`dist/vue.global.prod.js`?
- **jsdelivr**: 和`unpkg`类似，也是为了支持[jsdelivr](https://www.jsdelivr.com/documentation#id-npm)。
- **types**: 指定包的类型声明文件。
- **files**: 上传到 npm 需要包含的文件。[这里](https://areknawo.com/whats-what-package-json-cheatsheet/#files)解释的不错。
- **exports**: 指定除了主入口文件之外还可以通过相对路径(相对包的根目录)指定引入其他的文件；其中可以通过`types`, `import`和`require`来进一步指定不同模块方式下的引入对应文件。例如对于`./server-renderer`

  ```json
  {
    "./server-renderer": {
      "types": "./server-renderer/index.d.ts",
      "import": "./server-renderer/index.mjs",
      "require": "./server-renderer/index.js"
    }
  }
  ```

  ```js
  // esm: ./server-renderer/index.mjs
  import { renderToString } from 'vue/server-renderer'

  // cjs: ./server-renderer/index.js
  const { renderToString } = require('vue/server-renderer')
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
