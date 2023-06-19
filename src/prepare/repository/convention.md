本篇主要简单的过一下 vue3 仓库里的一些代码规范，即以下相关命令

```json
{
  "check": "tsc --incremental --noEmit",
  "lint": "eslint --cache --ext .ts packages/*/{src,__tests__}/**.ts",
  "format": "prettier --write --cache --parser typescript \"**/*.[tj]s?(x)\"",
  "format-check": "prettier --check --cache --parser typescript \"**/*.[tj]s?(x)\"",
  "preinstall": "node ./scripts/preinstall.js",
  "postinstall": "simple-git-hooks"
}
```

`check`命令就是编译 ts，检查是否类型有问题。

## 代码格式规范

`lint`, `format`, `format-check`都是代码书写格式的规范，其中`eslint`主要是静态代码错误的检查，`prettier`用来格式化代码

## 指定包管理工具

`preinstall`是包管理工具在`install`前的 hook，这里主要通过`process.env.npm_execpath`用来限制使用`pnpm`来安装

```js
// @ts-check
if (!/pnpm/.test(process.env.npm_execpath || '')) {
  console.warn(
    `\u001b[33mThis repository requires using pnpm as the package manager ` +
      ` for scripts to work properly.\u001b[39m\n`
  )
  process.exit(1)
}
```

不过目前可以直接在`package.json`里的`packageManager`字段直接指定即可

```json
{
  "packageManager": "pnpm@8.4.0"
}
```

## 指定 node 版本

我们也可以限制`node`的版本

```json
{
  "engines": {
    "node": ">=16.11.0"
  }
}
```

## lint-staged

通过[lint-staged](https://www.npmjs.com/package/lint-staged)在代码流程中执行一些操作，如格式化代码; 我们需要在`package.json`进行一些配置，如：

```json
{
  "lint-staged": {
    "*.{js,json}": ["prettier --write"],
    "*.ts?(x)": ["eslint", "prettier --parser=typescript --write"]
  }
}
```

通过以上配置后，我们执行`npx lint-staged`就会对配置里对应的文件进行处理。

## git hook 规范 commit message

`postinstall`是包管理工具在`install`后的 hook，这里用来初始化[simple-git-hooks](https://www.npmjs.com/package/simple-git-hooks)来规范`commit message`的规范，我们需要在`package.json`进行一些配置。

```json
{
  "simple-git-hooks": {
    "pre-commit": "pnpm lint-staged && pnpm check",
    "commit-msg": "node scripts/verifyCommit.js"
  }
}
```

以上配置了两个`hooks`，一个是`pre-commit`，会在**输入提交信息前**执行对应的命令，即`pnpm lint-staged && pnpm check`；另一个是`commit-msg`，在**输入提交信息后，提交代码前**执行对应的命令，这里主要是校验提交信息的格式：`scripts/verifyCommit.js`

```js
const msgPath = path.resolve('.git/COMMIT_EDITMSG')
const msg = readFileSync(msgPath, 'utf-8').trim()

const commitRE =
  /^(revert: )?(feat|fix|docs|dx|style|refactor|perf|test|workflow|build|ci|chore|types|wip|release)(\(.+\))?: .{1,50}/

if (!commitRE.test(msg)) {
  // 校验不通过...
}
```

其中`.git/COMMIT_EDITMSG`就是输入提交信息后信息暂存的文件位置。
