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

::: details 为什么开发用 esbuild，生产用 rollup？
我们知道 esbuild 是通过`Go`编写的，可以直接使用编译后的打包代码进行打包处理，所以速度非常快，可以有**更好的开发体验**。但是 rollup 打包出来的体积更小，且有更好的[tree-shaking](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking)。其实在生产环境的打包是用 **rollup with esbuild**的方式打包(结合[rollup-plugin-esbuild](https://www.npmjs.com/package/rollup-plugin-esbuild))。
:::

#### 使用

在执行脚本时，直接提供要打包的包名(精准匹配)即可。e.g. `node scripts/dev.js runtime-dom`。包名默认为`vue`

此外还可以提供以下参数，脚本是通过[minimist](https://www.npmjs.com/package/minimist)处理参数的。

- `-f`: 指定打包的格式，包括`global`, `esm-bundler`, `esm-browser`, `cjs`以及`vue`包额外的格式`global-runtime`, `esm-bundler-runtime`, `esm-browser-runtime`；默认`global`；具体每种格式的含义在分析[打包](./build#打包格式)相关命令脚本时再展开。
- `-i`: (inline)是否将依赖包一起打包进去；不提供即 `false`；
  ::: tip
  为`false`时只对`cjs`和`esm-bundler(-runtime)`格式会 external 掉所有的依赖包。
  其他`global`, `esm-browser`格式都需要 inline 所有依赖包以可以单独使用。具体可看[打包格式的介绍](./build#基本关系图)
  :::

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

#### 引包规则

在`vue`包的`package.json`中指定入口文件的部分如下所示：

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
- **jsdelivr**: 和`unpkg`类似，也是为了支持[jsdelivr](https://www.jsdelivr.com/documentation#id-npm)。不过`jsdelivr`会代码压缩后返回`vue.global.js`。
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

#### 对\_\_esModule 标识的补充

在打包出来的`.cjs.js`中，我们可以看到前面有这么一句

```js
Object.defineProperty(exports, '__esModule', { value: true })
```

这是因为在`rollup`配置了`output.esModule: true`，那么在打包时就会对打包的模块**标记成`es`模块**。

为了弄清楚**为什么要这个标记**以及**这个标记是给谁用的**，我们来看一个例子：

::: tip
以下是在 node 环境下跑的，为了使用`es`模块化，可以设置 package.json 的 type 为 module，或者命名为.mjs 文件；下面我们就直接写.js 后缀表示了
:::

我们有`index.js`, `es.js`和`cjs.js`文件，现在希望在`es.js`用`es`模块化方式导出数据，在`cjs.js`用`CommonJs`方式导出数据，然后`index.js`引入数据。

导出的数据有**默认数据`name`**，以及具名数据`age`。不过到这里应该就有个疑问：`CommonJs`该如何以默认的方式导出数据？似乎没有。那我们就用`module.exports.default`来暂且代替试试吧。

::: code-group

```js [index.js]
import defaultName, { age } from './es.js'
console.log(defaultName, age) // 'leo' 16

import defaultName, { age } from './cjs.js'
console.log(defaultName, age) // { default: 'leo', age: 16 } 16
```

```js [es.js]
const name = 'leo'
const age = 16

export default name
export { age }
```

```js [cjs.js]
const name = 'leo'
const age = 16

module.exports.default = name
module.exports.age = age
```

:::

结果发现从`cjs.js`导入的默认数据就是整个`module.exports`对象。出现这样的差异，是因为**CommonJS 方式没有提供默认导出的方式**。

要解决这个问题，一些打包工具提出了用`__esModule`属性来对`cjs模块`进行标识，来**告诉打包工具**在用`es`模块化引入该`cjs模块`时，默认导出数据就是`module.exports.default`上的数据。所以上面的两个问题就有了解答：

- **为什么要这个标记**: `CommonJs`没有提供默认导出数据的方式，`es`模块化导入时会产生差异
- **这个标记是给谁用的**: 给打包工具识别的，所以本质是一种约定俗成的解决方案。

那么下面我们就用`rollup`来对其进行打包，看看能不能让`cjs.js`拥有默认导出的能力~

我们用到了[@rollup/plugin-commonjs](https://www.npmjs.com/package/@rollup/plugin-commonjs)插件来处理`es`引入`cjs`的情况。

::: code-group

```js{11} [打包结果 bundle.js]
'use strict';

var cjs = {};

const name = 'leo';
const age = 16;

cjs.default = name;
var age_1 = cjs.age = age;

console.log(cjs, age_1); // { default: 'leo', age: 16 } 16

exports.age = age_1;
exports.name = cjs;
```

```js [rollup.config.js]
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'index.js',
  output: {
    file: 'bundle.js',
    format: 'cjs' // 这个是最终打包成的格式，是什么对例子没有关系
    // esModule: true 设为true就对最终打包结果进行es标识，默认为false
  },
  plugins: [commonjs()]
}
```

:::

发现结果还是一样，因为还没有对`cjs.js`加标识呢。我们看看加了标识后的打包结果：

::: code-group

```js{5,10,13} [打包结果 bundle.js]
'use strict';

var cjs = {};

Object.defineProperty(cjs, '__esModule', { value: true }); // 一起打包进来了。。。不过起作用了

const name = 'leo';
const age = 16;

var _default = cjs.default = name; // 取了default属性作为默认导出
var age_1 = cjs.age = age;

console.log(_default, age_1); // 'leo' 16

exports.age = age_1;
exports.name = _default;
```

```js{1} [es标识的cjs.js]
Object.defineProperty(exports, '__esModule', { value: true });

const name = 'leo'
const age = 16

module.exports.default = name
module.exports.age = age
```

:::

::: tip
如果`cjs.js`里没有`module.exports.default = name`这一句，那么即使标识了也不会有默认导出的，行为会和没有标识一样，因为打包工具找不到`default`属性的值。
:::

至此我们基本明白`__esModule`的作用了。

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

::: details 脚本的书写方式

- 通过`// ts-check`可以让对应的 js 文件纳入 ts 检查

```js
// @ts-check
let x = 3
x = '' // [!code error] // Type 'string' is not assignable to type 'number'.ts(2322)
```

- 使用`esm`方式导入；有两种方式可以实现在`node`环境使用`esm`引包方式：1. 通过指定`package.json`里的`type`为`module`；2. 通过命名文件后缀为`.mjs`；以下是在`node`环境使用`esm`时一些区别调整：
  - `__dirname` 不再适用，应该为`import { dirname } from 'node:path'` 里的`dirname`函数方法
    ```js
    import { dirname } from 'node:path'
    import { fileURLToPath } from 'node:url'
    // import.meta.url即当前执行脚本的fileUrl: e.g. file:///Users/xxx/xxx/index.js
    // fileURLToPath(import.meta.url) 之后就是 /Users/xxx/xxx/index.js
    const __dirname = dirname(fileURLToPath(import.meta.url))
    ```
  - 动态导入可以通过`createRequire`方法实现
    ```js
    import { createRequire } from 'node:module'
    const require = createRequire(import.meta.url)
    const pkg = require('./package.json')
    ```

:::

### [pre-dev-sfc.js](https://github.com/vuejs/core/blob/main/scripts/pre-dev-sfc.js)

此脚本主要是在执行`dev-sfc`之前确保其所依赖的包都已经打包好了。否则就执行`npm run build-compiler-cjs`以确保依赖包的打包工作已完成。

## 核心包开发命令

### dev

对应于`node scripts/dev.js`。

前面我们知道`dev.js`默认开发的包是`vue`，打包方式是`global(iife)`，所以此命令就是用来开发`global`打包的`vue`的。

### dev-esm

对应于`node scripts/dev.js -if esm-bundler-runtime`。

即开发的包是`vue`，打包方式是`esm-bundler-runtime`，并且是将所有依赖包都打包进来的 inline 模式。

因为[esm-bundler 格式](./build.md#打包格式)下生产环境打包回`external`掉所有依赖包的，而这里提供`inline`选项就可以在开发时更好的调试。

## 辅助工具的开发

### dev-compiler

对应于`run-p \"dev template-explorer\" serve`，用于开发[编译器转译工具](https://template-explorer.vuejs.org/)。

其中`run-p`是指并行运行`pnpm dev template-explorer`和`pnpm serve`命令，用的是[npm-run-all](https://github.com/mysticatea/npm-run-all)这个工具。

- **pnpm dev template-explorer**：相当于`node scripts/dev.js template-explorer`所以此时使用`global`格式打包的`template-explorer`这个包。
- **pnpm serve**：基于项目根目录启动一个静态资源服务器，这样我们就可以直接访问本地进行开发`http://localhost:5000/packages/template-explorer/local.html`(对应的就是`open`命令)
  ::: details 如何访问 template-explorer
  `template-explorer`包下有两个 html 文件：`index.html`和`local.html`。
  其两者的区别就是 local 引用的资源是本地的，而 index 是用 CDN 的资源。

  ```html{24}
  <title>Vue Template Explorer</title>
  <link
    rel="stylesheet"
    data-name="vs/editor/editor.main"
    href="https://unpkg.com/monaco-editor@0.20.0/min/vs/editor/editor.main.css" // [!code warning] // index
    href="./node_modules/monaco-editor/min/vs/editor/editor.main.css" // [!code warning] // local
  />
  <link rel="stylesheet" href="./style.css" />

  <div id="header"></div>
  <div id="source" class="editor"></div>
  <div id="output" class="editor"></div>

  <script src="https://unpkg.com/monaco-editor@0.20.0/min/vs/loader.js"></script> // [!code warning] // index
  <script src="./node_modules/monaco-editor/min/vs/loader.js"></script> // [!code warning] // local
  <script>
    require.config({
      paths: {
        vs: 'https://unpkg.com/monaco-editor@0.20.0/min/vs' // [!code warning] // index
        vs: './node_modules/monaco-editor/min/vs' // [!code warning] // local
      }
    })
  </script>
  <script src="./dist/template-explorer.global.js"></script>
  <script>
    require(['vs/editor/editor.main'], init /* injected by build */)
  </script>
  ```

  引用的打包资源就是`./dist/template-explorer.global.js`。
  :::

### dev-sfc

对应于`run-s dev-sfc-prepare dev-sfc-run`，用于开发[在线演练场](https://play.vuejs.org)。

其中`run-s`是指串行执行命令。

- **dev-sfc-prepare**: 即在执行`dev-sfc`之前确保其所依赖的包都已经打包好了。否则就执行`npm run build-compiler-cjs`。
- **dev-sfc-run**: 这个命令对应于`run-p \"dev compiler-sfc -f esm-browser\" \"dev vue -if esm-bundler-runtime\" \"dev server-renderer -if esm-bundler\" dev-sfc-serve`。即并行执行开发`sfc-playground`依赖的`compiler-sfc`, `vue`和`server-renderer`这几个包，以及启动`sfc-playground`的开发服务器。

## 总结

- 介绍了`dev.js`脚本的[使用](#使用)，可以监听并以指定参数打包对应包从而进行开发
- 介绍了基本的[引包规则](#引包规则)，主要包括`main`, `module`, `unpkg`和`jsdelivr`等字段
- 补充说明了打包工具通过[\_\_esModule](#对-esmodule-标识的补充)标识解决`CommonJs`没有默认导出的问题
- 仓库[编写脚本的方式](#实现)
- 简单介绍了每个`scripts`命令的用途
