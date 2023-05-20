对于打包相关命令，主要基于[scripts/build.js](https://github.com/vuejs/core/blob/main/scripts/build.js)这个脚本，以及`rollup.config.js`和`rollup.dts.config.js`所以了解了这个脚本和 rollup 的配置，我们就基本了解了`package.json`下所有的打包相关命令了。

此外`rollup.config.js`会用到[scripts/aliases.js](#aliases-脚本)和[scripts/const-enum.js](#const-enum-脚本)

```json
{
  "build": "node scripts/build.js",
  "build-dts": "tsc -p tsconfig.build.json && rollup -c rollup.dts.config.js",
  "build-sfc-playground": "run-s build-compiler-cjs build-runtime-esm build-ssr-esm build-sfc-playground-self",
  "build-compiler-cjs": "node scripts/build.js compiler reactivity-transform shared -af cjs",
  "build-runtime-esm": "node scripts/build.js runtime reactivity shared -af esm-bundler && node scripts/build.js vue -f esm-bundler-runtime && node scripts/build.js vue -f esm-browser-runtime",
  "build-ssr-esm": "node scripts/build.js compiler-sfc server-renderer -f esm-browser",
  "build-sfc-playground-self": "cd packages/sfc-playground && npm run build",

  "size": "run-s size-global size-baseline",
  "size-global": "node scripts/build.js vue runtime-dom -f global -p",
  "size-baseline": "node scripts/build.js vue -f esm-bundler-runtime && node scripts/build.js runtime-dom runtime-core reactivity shared -f esm-bundler && cd packages/size-check && vite build && node brotli"
}
```

我们会首先看看是如何使用这个脚本来打包的，以及[基于此](https://github.com/vuejs/core/blob/main/packages/vue/README.md#which-dist-file-to-use)过一遍[每种打包格式的介绍](#打包格式)，接着对于实现会主要关注以下几点：

- [具体打包一个包的实现与配置](#打包单个包)
- [并行打包](#并行打包流程-runparallel)
- [打包类型声明文件](#打包类型声明)
- 了解[const-enum.js](#const-enum-脚本)是如何利用`ast`做扫描和缓存处理的

## 使用

脚本可以用来并行打多个包，打包名称支持模糊搜索，不提供则打包所有。

```bash
$ node scripts/build.js runtime-core runtime-dom
# or fuzzy matching，do not forget the -a option
$ node scripts/build.js runtime -a
```

下面是具体可选的参数：

- `-f (formats)`: 指定[打包格式](#打包格式)；[文档](https://github.com/vuejs/core/blob/main/.github/contributing.md#build-formats)里说可以支持指定多种打包格式，用","隔开，但是目前应该还是一个没有修复的小[issue](https://github.com/vuejs/core/issues/2448)。默认格式为`esm-bundler`和`cjs`，配置在`rollup.config.js`。
- `-d (devOnly)`: 是否只打包开发代码；默认就是 false。
- `-p (prodOnly)`: 是否只打包生产代码；默认就是 false。如果同时制定了`-d`和`-p`，`-d`优先级高。
- `-t (buildTypes)`: 是否打包类型声明文件。
- `-s (sourceMap)`: 是否打包输出 sourcMap 文件。
- `-a (buildAllMatching)`: 在模糊搜索时是否将所有匹配到的包都打包，false 则打包第一个匹配到的(按包目录名称顺序)。
- `--release`: 是否是 release 状态。

## 打包格式

在前面已经提到了很多次各种打包格式(formats)了，那么在这里再对每种介绍一遍。

### 基本关系图

对于`rollup`来说主要`formats`有三种，`iife`, `cjs`和`es`。基于此三类，我们再根据`external`, `入口文件`和`生产/开发`环境区分出不同的打包格式(输出不同的文件)。

```mermaid
flowchart LR
  iife["iife"]:::format
  cjs["cjs"]:::group
  es["es"]:::format

  global["global.js"]
  global-prod["global.prod.js"]
  global-runtime["runtime.global.js"]
  global-runtime-prod["runtime.global.prod.js"]

  cjs-normal["cjs.js"]
  cjs-prod["cjs.prod.js"]

  esm-browser["esm-browser.js"]
  esm-browser-prod["esm-browser.prod.js"]
  esm-browser-runtime["runtime.esm-browser.js"]
  esm-browser-runtime-prod["runtime.esm-browser.prod.js"]

  esm-bundler["esm-bundler.js"]
  esm-bundler-runtime["runtime.esm-bundler.js"]

  global-group["global"]:::group
  iife -- inline --> global-group
  global-normal-group["global with compiler"]:::runtimeGroup
  global-runtime-group["global without compiler"]:::runtimeGroup
  global-group --> global-normal-group
  global-group --> global-runtime-group
  global-normal-group --> global
  global-normal-group --> global-prod
  global-runtime-group --> global-runtime
  global-runtime-group --> global-runtime-prod

  esm-browser-group["esm-browser"]:::group
  es -- inline --> esm-browser-group
  esm-browser-normal-group["esm-browser with compiler"]:::runtimeGroup
  esm-browser-runtime-group["esm-browser without compiler"]:::runtimeGroup
  esm-browser-group --> esm-browser-normal-group
  esm-browser-group --> esm-browser-runtime-group
  esm-browser-normal-group --> esm-browser
  esm-browser-normal-group --> esm-browser-prod
  esm-browser-runtime-group --> esm-browser-runtime
  esm-browser-runtime-group --> esm-browser-runtime-prod


  esm-bundler-group["esm-bundler"]:::group
  es -- external --> esm-bundler-group
  esm-bundler-normal-group["esm-bundler with compiler"]:::runtimeGroup
  esm-bundler-runtime-group["esm-bundler without compiler"]:::runtimeGroup
  esm-bundler-group --> esm-bundler-normal-group
  esm-bundler-group --> esm-bundler-runtime-group
  esm-bundler-normal-group --> esm-bundler
  esm-bundler-runtime-group --> esm-bundler-runtime

  cjs -- external --> cjs-normal
  cjs -- external --> cjs-prod

  vue-runtime["runtime entry point is vue/src/runtime.ts"]:::desc
  global-runtime --> vue-runtime
  global-runtime-prod --> vue-runtime
  esm-browser-runtime --> vue-runtime
  esm-browser-runtime-prod --> vue-runtime
  esm-bundler-runtime --> vue-runtime

  classDef format fill:#f96
  classDef group fill:#aff
  classDef runtimeGroup fill:#ee3
  classDef desc fill:#f99
```

### 具体描述

- **global**:
  - 通过`iife`的方式打包
  - `inline`所有依赖包
  - 包的名字，即挂载到全局对象上的变量名，会在对应的`package.json`里`buildOptions.name`指定；通常就是用于`<script src="...">`的方式(e.g. CDN)引入时；`<script src="https://cdn.jsdelivr.net/npm/vue/dist/vue.global.prod.js">`或者`<script src="https://cdn.jsdelivr.net/npm/vue">`(注意后面没有`/`，[默认指向](./dev.md#引包规则)`vue.global.js`)
  - 生成的文件有`<包对应的名字>.global(.prod).js`
  - 对于`vue`包会多一种打包规则：`global-runtime`，生成`vue(.runtime).global(.prod).js`，表示只包含`runtime`的的代码，没有包含`编译系统`。
- **cjs**:
  - 打包成在`node`环境下可用`require`的方式引入的格式；用在`ssr`
  - `external`所有依赖包
  - 生成的文件有`<包对应的名字>.cjs(.prod).js`
- **esm-browser**:
  - 打包成`esm`模块供浏览器使用，如`<script type="module">`通过`CDN`引入`https://cdn.jsdelivr.net/npm/vue@next/dist/vue.esm-browser.js`
  - `inline`所有依赖包
  - 生成的文件有`<包对应的名字>.esm-browser(.prod).js`
  - 对于`vue`包会多一种打包规则：`esm-browser-runtime`，生成`vue(.runtime).esm-browser(.prod).js`，表示只包含`runtime`的的代码，没有包含`编译系统`。
- **esm-bundler**:
  - 用于用户自己处理打包问题和选择打包工具(bundler)，如使用`webpack`, `rollup`和`parcel`；
  - 类似于`cjs`格式(也是自己处理 bundler)，只是以`esm`模块的方式提供
  - `external`所有依赖包；所以开发时有提供[dev-esm](./dev.md#dev-esm)命令
  - 生成的文件有`<包对应的名字>.esm-bundler.js`；注意没有`prod`，因为需要我们自己处理打包问题如压缩代码等
  - 对于`vue`包会多一种打包规则：`esm-bundler-runtime`，生成`vue(.runtime).esm-browser.js`，表示只包含`runtime`的的代码，没有包含`编译系统`。

## 实现

`build.js`脚本的整体执行顺序是：`处理可选参数` -> [扫描缓存 enum](#enum-类型的-ast) -> [并行](#并行打包流程-runparallel)[打包](#打包单个包) -> `检查包大小` -> [打包类型声明文件](#打包类型声明)。

[可选参数](#使用)上面已经介绍了；对于[const-enum.js](#const-enum-脚本)的`scanEnums`方法如何`扫描缓存enum`的，因为涉及代码的语法解析，我们放在[最后](#babel-处理-ast)再去分析，我们只需要知道此方法可以帮我们缓存所有的 enum 变量，然后再并行打包时复用；`检查包大小`主要是检查`global.prod.js`文件在三种处理下的大小：**压缩后代码**, **gzip 算法**和**brotli 算法**。所以接下来我们来看主要打包过程。

### 打包单个包

对于并行打包，最终还是回到通过脚本执行单个打包的逻辑，所以我们先看看打一个包的主要内容。主要涉及脚本里的`build`方法和`rollup.config.js`。

#### build

`build`方法其实主要就是调用`rollup -c --environment <环境变量>`并处理所需参数。其中有以下几点逻辑：

- 如果在`isRelease`状态，且没有指定打包的包(all)，其会忽略`private`包(虽然在过滤匹配包时已经处理了)
- 如果有指定打包的格式，那么就不移除已存在的`dist`文件夹

接着交给`rollup`处理

```js
await execa(
  'rollup',
  [
    '-c',
    '--environment',
    [
      `COMMIT:${commit}`,
      `NODE_ENV:${env}`,
      `TARGET:${target}`, // 包名
      formats ? `FORMATS:${formats}` : ``,
      prodOnly ? `PROD_ONLY:true` : ``,
      sourceMap ? `SOURCE_MAP:true` : ``
    ]
      .filter(Boolean)
      .join(',')
  ],
  { stdio: 'inherit' }
)
```

#### rollup.config.js

主要打包的逻辑应该在`rollup`配置文件里。

在脚本`build`方法里跳用`rollup`命令后会通过`--environment`参数提供环境变量给`rollup.config.js`，所以`rollup.config.js`通过不同的参数生成不同的`rollup`配置。

::: tip
最终的配置是一个数组，会根据有多少种`格式(formats)`以及`生产/开发`环境来确定配置数组，配置数组的个数对应就是最后输出不同打包文件的个数，具体文件类型可看[格式关系图](#基本关系图)。
:::

首先我们看看整体是如何生成配置数组的。

```js{3,11,14}
const packageConfigs = process.env.PROD_ONLY
  ? []
  : packageFormats.map(format => createConfig(format, outputConfigs[format]))

if (process.env.NODE_ENV === 'production') {
  packageFormats.forEach(format => {
    if (packageOptions.prod === false) {
      return
    }
    if (format === 'cjs') {
      packageConfigs.push(createProductionConfig(format))
    }
    if (/^(global|esm-browser)(-runtime)?/.test(format)) {
      packageConfigs.push(createMinifiedConfig(format))
    }
  })
}

export default packageConfigs
```

可以看到主要用是`createConfig`, `createProductionConfig`和`createMinifiedConfig`三个方法创建一个配置对象。其中`createProductionConfig`和`createMinifiedConfig`也是基于`createConfig`的。

- `createProductionConfig`: 只是简单的打包成`.prod.js`文件，**单独对`cjs`格式处理**；但是和`直接用createConfig`一样，并没有压缩代码，所以**最终`cjs.js`和`cjs.prod.js`文件内容是一样的**，原因暂不清楚
- `createMinifiedConfig`: 打包`.prod.js`文件，利用[@rollup/plugin-terser](https://www.npmjs.com/package/@rollup/plugin-terser)压缩了代码

在`开发`环境时只会直接用`createConfig`生成配置；生产环境会额外(除非 prodOnly)加入`.prod.js`文件。我们主要来看一下`createConfig`方法里的以下几点：

**打包入口文件**

主要是区分了`runtime-only`和`包含comelier`的入口。对于`@vue/compat`包进一步区分了`esm`和`non-esm`的入口文件。

```js
let entryFile = /runtime$/.test(format) ? `src/runtime.ts` : `src/index.ts`

// the compat build needs both default AND named exports. This will cause
// Rollup to complain for non-ESM targets, so we use separate entries for
// esm vs. non-esm builds.
if (isCompatPackage && (isBrowserESMBuild || isBundlerESMBuild)) {
  entryFile = /runtime$/.test(format)
    ? `src/esm-runtime.ts`
    : `src/esm-index.ts`
}
```

**rollup-plugin-esbuild**

build 的过程其实也是用了`esbuild`进行处理的，主要通过[rollup-plugin-esbuild](https://www.npmjs.com/package/rollup-plugin-esbuild)插件实现。

部分代码如下：

```js
import esbuild from 'rollup-plugin-esbuild'

function createConfig() {
  // rollup config object
  return {
    plugins: [
      // [!code focus:8]
      esbuild({
        tsconfig: path.resolve(__dirname, 'tsconfig.json'),
        sourceMap: output.sourcemap,
        minify: false, // [!code warning] // 不使用esbuild插件进行代码压缩
        target: isServerRenderer || isNodeBuild ? 'es2019' : 'es2015',
        define: resolveDefine() // [!code warning] // 定义打包注入的变量
      })
    ]
  }
}
```

其中代码压缩(.prod.js)并没有用这个插件去处理，而是通过前面提到的`createMinifiedConfig`方法利用[@rollup/plugin-terser](https://www.npmjs.com/package/@rollup/plugin-terser)进行压缩，因为后者能够压缩更小体积的代码。

`define: resolveDefine()`这里就是定义[注入的变量](https://github.com/vuejs/core/blob/main/packages/global.d.ts)。

**打包变量注入/替换**

::: info
以下**注入/替换**统一称作**注入**
:::

在注入时用到了两个方法：`resolveDefine`和`resolveReplace`。 `resolveDefine`就是普通的定义需要注入的变量的值：

```js
// define object
{
  __VERSION__: '"3.3.2"'
}

// before bundling
console.log(__VERSION__)

// after bundling
console.log('3.3.2')
```

`resolveReplace`也是用来生成注入变量的对象`(待注入的key - 注入的值)`的，不同之处在于`resolveDefine`直接将生成的对象提供给`rollup-plugin-esbuild`插件处理，`resolveReplace`是通过[@rollup/plugin-replace](https://www.npmjs.com/package/@rollup/plugin-replace)插件进行处理的。

原因是`rollup-plugin-esbuild`插件处理注入时会严格限定`注入的值`为`valid JSON syntax`，所以我们需要通过`@rollup/plugin-replace`注入这些特殊的值。

```js
// e.g.
{
  'process.env': '({})',
  'context.onError(': `/*#__PURE__*/ context.onError(`,
}

// rollup-plugin-esbuild will throw error:
// error: Invalid define value (must be an entity name or valid JSON syntax)
```

对于打包时的`别名识别`和注入`enum`类型的处理分别涉及脚本`aliases.js`和`const-enum.js`。

#### [aliases 脚本](https://github.com/vuejs/core/blob/main/scripts/aliases.js)

这个脚本就是为了获取`别名`的`entries`定义，使`别名`对应到`packages/<包名>/src/index.ts`。

每个包引用的别名规则是`@vue/<对应`packages`下目录名>`，除了辅助工具包(不需要应用别名): `sfc-playground`, `size-check`, `template-explorer`和`dts-test`以及以下几个包：

| 包目录名        |        别名         |
| --------------- | :-----------------: |
| vue             |         vue         |
| compiler-sfc    |  vue/compiler-sfc   |
| server-renderer | vue/server-renderer |
| vue-compat      |     @vue/compat     |

#### [const-enum 脚本](https://github.com/vuejs/core/blob/main/scripts/const-enum.js)

由于通过`rollup-plugin-esbuild`插件在`insolation mode`打包会将`const enum`类型编译进运行时，此举会减慢打包速度以及最终打包出来的体积。所以脚本会将`const enum`类型通过上面提到的`resolveReplace`注入掉。最终比较如下：

::: code-group

```ts [源码]
export const enum Test {
  TEST = 'TEST'
}

console.log(Test.TEST)
```

```js [打包后(cjs)]
var Test = /* @__PURE__ */ (Test2 => {
  Test2['TEST'] = 'TEST'
  return Test2
})(Test || {})

console.log('TEST' /* TEST */)
exports.Test
```

```js [使用脚本工具后打包]
console.log('TEST')
// 此处没有exports，因为其他import了Test的地方也会直接替换
```

:::

具体实现我们放在[最后](#babel-处理-ast)分析。其主要提供了三个东西：

- `scanEnum方法`：扫描出仓库里匹配`export const enum`的`const enum`类型，然后将数据 cache 住直至所有包并行打包完成
- `enumPlugin插件`：在`const enum`类型注入后移除`export const enum`语句；在`rollup-plugin-esbuild`插件之前处理，所以对于`esbuild`处理阶段`const enum`类型已经被注入实际对应的值，不用再处理了。
- `enumDefines注入对象`：`scanEnum`cache 的数据，`enum表达式`为键，实际值为值；e.g. `export const enum Test { TEST = 'TEST' }` -> `{ 'Test.TEST': 'TEST' }`

### 并行打包流程 runParallel

实现了对某一个包进行打包后，我们来看看是如何对多个包进行并行打包的。

```js{10-21}
async function buildAll(targets) {
  await runParallel(cpus().length, targets, build)
}
async function runParallel(maxConcurrency, source, iteratorFn) {
  const ret = []
  const executing = []
  for (const item of source) {
    const p = Promise.resolve().then(() => iteratorFn(item, source))
    ret.push(p)
    // 并发限制
    if (maxConcurrency <= source.length) {
      // e 作为一个promise，p fulfilled后就会将对应的e从executing中移除，以让出位置
      // 移除让位后 e 也fulfilled了
      const e = p.then(() => executing.splice(executing.indexOf(e), 1))
      executing.push(e)
      if (executing.length >= maxConcurrency) {
        // 并发数量已满，让现有的任务们race，从而fulfilled让位
        // 只要其中一个任务fulfilled就race完成，即让出一个位置，继续对source的循环
        await Promise.race(executing)
      }
    }
  }
  return Promise.all(ret)
}
```

我们知道前面的`build`方法本身是一个异步函数，所以我们其实可以直接用`Promise.all`来让多个`build`都异步执行即可。但是以上代码却通过`cpu`的最大个数来进行并行，换句话说就是`runParallel`做的是**并发限制**，其中`iteratorFn`就是对应单个包的`build`过程。

以下是一个输出例子：

```js
runParallel(
  2, // 最大并发数
  [1, 2, 3, 4, 5],
  item =>
    new Promise(res =>
      setTimeout(() => {
        console.log(item)
        res()
      }, 1000)
    )
)

// 1, 2
// after 1s
// 3, 4
// after 1s
// 5
```

不过不太清楚这里为什么要做并发控制，估计是考虑到当前打包计算机的资源分配问题吧。

### 打包类型声明

在将所有指定包打包完后，通过`-t (buildTypes)`选项可以选择是否同时打包输出类型声明文件。其过程就是执行了`rollup`相关命令。

```js
if (buildTypes) {
  await execa(
    'pnpm',
    [
      'run',
      'build-dts',
      ...(targets.length // targets 是要提供模糊搜索的名字数组
        ? // resolvedTargets 是通过targets解析出来的包名数组
          ['--environment', `TARGETS:${resolvedTargets.join(',')}`]
        : [])
    ],
    {
      stdio: 'inherit'
    }
  )
}
```

可以看到执行的是`pnpm build-dts`，对应于`tsc -p tsconfig.build.json && rollup -c rollup.dts.config.js`。

首先通过`tsc`基于`tsconfig.build.json`文件将所有包 src 下的代码的类型声明文件编译出来，然后再用`rollup`将每个包对应的类型声明文件打包进一个文件并输出于对应的`dist`文件中。

#### [tsconfig.build.json](https://github.com/vuejs/core/blob/main/tsconfig.build.json)

这个文件是 extends 于`tsconfig.json`的，里面我们主要关注一下几个配置：

- **compilerOptions.outDir**: 编译输出的文件夹，此处值为`temp`，所以`tsc -p tsconfig.build.json`之后就会在`temp`文件夹生成**每个文件对应的类型声明文件**(即 src 目录及文件名和源码一样的结构)
- **compilerOptions.declaration**: 值为`true`，生成类型声明文件
- **compilerOptions.emitDeclarationOnly**: 值为`true`，**只**生成类型声明文件

#### [rollup.dts.config.js](https://github.com/vuejs/core/blob/main/rollup.dts.config.js)

此配置文件主要是将前面生成在`temp`里的类型声明文件打包成一个整体的`<包名>.d.ts`文件，并输出到对应包的`dist`中。
其会根据`temp/<package>/src/index.d.ts`为入口文件进行打包，**打包格式为`esm`**，且不会`inline`依赖包的类型。

例如`vue`的打包过程：

```mermaid
flowchart LR
  vue["packages/vue/dist/vue.d.ts"]
  dev["temp/packages/vue/src/dev.d.ts"] --> vue
  index["temp/packages/vue/src/index.d.ts (entry)"] --> vue
  runtime["temp/packages/vue/src/runtime.d.ts"] --> vue
```

#### patchTypes plugin

里面用到了[rollup-plugin-dts](https://www.npmjs.com/package/rollup-plugin-dts)和一个自定义插件`patchTypes`，我们主要来看看自定义插件`patchTypes`。

具体实现和[const-enum.js](#babel-处理-ast)部分类似，都是通过`babel`解析`ast`，就不重复分析了。我们主要看看其用途：

::: details

- **移除所有标记了@internal 的类型属性**

export 的类型，以及`type`, `interface`, `class`里的属性只要标记了`@internal`就不会打包进去。

```ts
export type SSRContext = {
  [key: string]: any
  teleports?: Record<string, string>
  /**
   * @internal
   */
  __teleportBuffers?: Record<string, SSRBuffer>
  /**
   * @internal
   */
  __watcherHandles?: (() => void)[]
}

// after bundling
export type SSRContext = {
  [key: string]: any
  teleports?: Record<string, string>
  /* removed internal: __teleportBuffers */
  /* removed internal: __watcherHandles */
}
```

- **将 export 里所有的类型转化为 inline 导出的形式**

```ts
type Foo = number
type Bar = string
export { Foo, Bar }

// ->
export Foo = number
export Bar = string
```

如果不转换，会在 vitepress `defineComponent`里报`the inferred type cannot be named without a reference`，暂时不清楚为啥。

- **追加自定义的一些额外类型声明**

这一步会将对应包`packages/${pkg}/types`文件夹下的所有类型声明一个个追加到打包好的整体声明文件末尾。

`packages/${pkg}/types`下的文件不会纳入编译，`tsc -p tsconfig.build.json`只包含了`packages/${pkg}/src`下的文件。

```ts
// packages/vue/types/jsx-register.d.ts
import '../jsx'

// packages/vue/distvue.d.ts
...
export { compileToFunction as compile };
...
import '../jsx'
```

:::

## babel 处理 ast

前面的[const-enum.js](#const-enum-脚本)脚本和[patchTypes](#patchtypes-plugin)插件具体实现都涉及到了用`@babel/parser`的[parse](https://babeljs.io/docs/babel-parser#api)方法得到`ast`并结合[magic-string](https://www.npmjs.com/package/magic-string)来进行转换源码的操作。我们知道`ast`是对源码编译后生成的一个对应对象(即抽象语法树)，所以除去具体的如何编译成语法树的算法，剩下的各种树节点的类型(变量，函数，导出等，以及每个节点的起始结束位置等信息)其实也没什么需要说明的，主要还是在[文档](https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md)找到对应的类型含义。

这里有一个[在线语法树生成工具](https://lihautan.com/babel-ast-explorer/)可以参考用一下。下面我们对`const-enum.js`脚本里用到的一些节点类型进行简单地说明。

### enum 类型的 ast

以下代码和编译成的对应 ast 如下所示：**大部分 ast 属性已省略**。

::: code-group

```ts [源码]
export const enum Test {
  Foo = 'foo value'
}

export { Test }
```

```js{5-7,10,14,17,21,24,28,35,40,41-42,44,47} [ast]
const ast = {
  program: {
    body: [
      {
        type: 'ExportNamedDeclaration',
        start: 0,
        end: 46,
        specifiers: [],
        declaration: {
          type: 'TSEnumDeclaration',
          start: 7,
          end: 46,
          id: {
            type: 'Identifier',
            start: 18,
            end: 22,
            name: 'Test'
          },
          members: [
            {
              type: 'TSEnumMember',
              id: {
                type: 'Identifier',
                name: 'Foo'
              },
              initializer: {
                type: 'StringLiteral',
                value: 'foo value'
              }
            }
          ]
        }
      },
      {
        type: 'ExportNamedDeclaration',
        start: 48,
        end: 63,
        specifiers: [
          {
            type: 'ExportSpecifier',
            start: 57,
            end: 61,
            local: {
              type: 'Identifier',
              start: 57,
              end: 61,
              name: 'Test'
            }
          }
        ]
      }
    ]
  }
}
```

:::

重点需要关注用到的已经高亮，其中有很多种`节点类型`，即`type`所指的东西；`start`和`end`指的是解析出来的节点类型所覆盖的起始和结束位置。

基于此我们可以来看看具体`const-enum.js`里`scanEnum`方法和`constEnum`方法返回的`enumPlugin`插件是如何利用这个`ast`对象进行对应处理的。

### scanEnum

前面我们说到这个方法的作用是扫描`const enum`类型然后将相关信息缓存起来。

信息数据会存在`temp/enum.json`里，每次执行完`build.js`脚本就会 remove 掉，格式为：

```ts
type enumData = {
  // Map: 文件路径名 -> "export const enum"匹配到的ExportNamedDeclaration节点起始结束位置数组
  ranges: Record<string, [number, number][]>
  // Map: enum名称.成员 -> 实际值; 后面用于打包注入对应的数据
  defines: Record<string, string>
  // 所有去重的enum名称
  ids: string[]
}
```

- **扫描**: 这一步其实就是用`git grep "export const enum"`命令获取仓库的所有匹配包含`export const enum`的文件。

  ```bash
  $ git grep "export const enum"

  packages/compiler-core/src/ast.ts:export const enum Namespaces {
  packages/compiler-core/src/ast.ts:export const enum NodeTypes {
  packages/compiler-core/src/ast.ts:export const enum ElementTypes {
  packages/compiler-core/src/ast.ts:export const enum ConstantTypes {
  ...
  ```

  接着通过`\n`和`:`分割**获取所有的文件路径**并去重，扫描就算完成了。

- **遍历文件获取 enum 信息**: 遍历上面获取的文件并读取文件内容为字符串，然后传给`@babel/parser.parse`函数获取`ast`。
  对应上面`ast`例子，我们可以获取到对应文件里每个匹配到的`export const enum`节点的起始结束位置，接着一个个 push 到放到`enumData.ranges`对应的数组里，获取每个 enum 名称，以及每个成员的值。

  以下是部分伪代码，`ast`的字段参考上面的`ast`对象：

  ```js{12,17,27}
  for (const filePath of filePaths) {
    const fileRawContent = fs.readFileSync(filePath, 'utf-8')
    const ast = parse(fileRawContent)

    for (const node of ast.program.body) {
      // 符合"export const enum <enum名称> { [成员] = 值 }"的类型节点
      if (
        node.type === 'ExportNamedDeclaration' &&
        node.declaration?.type === 'TSEnumDeclaration'
      ) {
        // 添加ranges数据
        enumData.ranges[filePath].push([node.start, node.end])

        // 添加enum名称
        const id = node.declaration.id.name
        if (!enumData.ids.includes(id)) {
          enumData.ids.push(id)
        }

        // 添加defines数据
        for (const member of node.declaration.members) {
          const memberPath = `${id}.${member.id.name}`
          const memberValue = member.initializer.value
          if (memberPath in enumData.defines) {
            throw new Error(`name conflict for enum ${id} in ${file}`)
          }
          enumData.defines[memberPath] = JSON.stringify(memberValue)
        }
      }
    }
  }
  ```

  还有省略的部分是一些细节处理部分，如处理`BinaryExpression`, `UnaryExpression`等。

  最后将`enumData`以 JSON 形式写入`temp/enum.json`等待`constEnum`函数使用。

### constEnum

此方法会返回一个 rollup 插件和用于打包注入的`enumData.defines`。

```js
import { constEnum } from './scripts/const-enum.js'
const [enumPlugin, enumDefines] = constEnum()
```

上面的代码会在`rollup.config.js`里执行，对于每一个包，都会重新执行一遍`rollup.config.js`，也每一个包都会执行一遍`constEnum`方法，所以我们已经先在`build,js`里执行了`scanEnum`缓存了所有`enumDefines`，并行打包所有包时就可以更快获取 enum 信息了。

### enumPlugin

此插件的作用就是在`esbuild`之前把`export const enum`相关节点代码移除掉。

分为两种情况：`export const enum <enum名称> { [成员] = 值 }`和`export { <enum名称> }`；第二种情况是指导出的`enum名称`是应该被移除的`export const enum`类型，即存在`enumData.ids`里。

第一种情况很简单，直接通过`enumData.ranges`的数据删除掉就行：

```js{7-9}
// rollup plugin
const plugin = {
  transform(rawCode, filePath) {
    if (filePath in enumData.ranges) {
      const s = new MagicString(rawCode)
      // 我们知道里面保存的就是节点的起始结束位置
      for (const [start, end] of enumData.ranges[filePath]) {
        s.remove(start, end)
      }
    }
  }
}
```

第二种情况需要动态通过正则检查，有重复导出的话再通过`ast`去找到移除：

```js{16}
const plugin = {
  transform(rawCode, filePath) {
    const reExportsRE = new RegExp(
      `export {[^}]*?\\b(${enumData.ids.join('|')})\\b[^]*?}`
    )

    if (reExportsRE.test(rawCode)) {
      const s = new MagicString(rawCode)
      const ast = parse(rawCode)

      for (const node of ast.program.body) {
        // 匹配为 export 类型，这里有省略其他条件
        if (node.type === 'ExportNamedDeclaration') {
          for (const spec of node.specifiers) {
            // 应该被移除，却重复导出的enum名称
            if (enumData.ids.includes(spec.local.name)) {
              // 下面就是移除操作，通过前一个导出变量或者后一个导出变量位置来处理
              const next = node.specifiers[i + 1]
              if (next) {
                // @ts-ignore
                s.remove(spec.start, next.start)
              } else {
                // last one
                const prev = node.specifiers[i - 1]
                // @ts-ignore
                s.remove(prev ? prev.end : spec.start, spec.end)
              }
            }
          }
        }
      }
    }
  }
}
```

以上就是`const-enum.js`脚本的基本实现了。

## 总结

- 介绍了打包脚本的[基本使用](#使用)和[打包格式](#打包格式)含义及整体关系图
- 介绍了打包过程的基本实现，包括[rollup 配置](#rollup-config-js)和[并行打包](#并行打包流程-runparallel)
- 介绍了打包过程中用到的脚本用途和基本实现
- 介绍了用`babel`处理`ast`在`const-enum.js`脚本上的应用
