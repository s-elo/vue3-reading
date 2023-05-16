对于打包相关命令，主要基于[scripts/build.js](https://github.com/s-elo/vue3-core/blob/main/scripts/build.js)这个脚本，以及`rollup.config.ts`和`rollup.dts.config.ts`所以了解了这个脚本和 rollup 的配置，我们就基本了解了`package.json`下所有的打包相关命令了。

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

我们会首先看看是如何使用这个脚本来打包的，以及过一遍[每种打包格式的介绍](https://github.com/vuejs/core/blob/main/packages/vue/README.md#which-dist-file-to-use)，接着对于实现会主要关注以下几点：

- 了解`scanEnums`函数是如何做扫描和缓存的
- 并行打包方法`runParallel`的实现
- 具体打包一个包的实现
- 打包后检查包大小的方法

## 使用

脚本可以用来并行打多个包，打包名称支持模糊搜索。

```bash
$ node scripts/build.js runtime-core runtime-dom
# or fuzzy matching，do not forget the -a option
$ node scripts/build.js runtime -a
```

下面是具体可选的参数：

- `-f (formats)`: 指定[打包格式](#打包格式)；[文档](https://github.com/s-elo/vue3-core/blob/main/.github/contributing.md#build-formats)里说可以支持指定多种打包格式，用","隔开，但是目前应该还是一个没有修复的小[issue](https://github.com/vuejs/core/issues/2448)。默认格式为`esm-bundler`和`cjs`，配置在`rollup.config.js`。
- `-d (devOnly)`: 是否只打包开发代码；默认就是 false。
- `-p (prodOnly)`: 是否只打包生产代码；默认就是 false。如果同时制定了`-d`和`-p`，`-d`优先级高。
- `-t (buildTypes)`: 是否打包类型声明文件。
- `-s (sourceMap)`: 是否打包输出 sourcMap 文件。
- `-a (buildAllMatching)`: 在模糊搜索时是否将所有匹配到的包都打包，false 则打包第一个匹配到的(按包目录名称顺序)。
- `--release`: 是否是 release 状态。

## 打包格式
