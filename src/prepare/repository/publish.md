发包主要用到了[scripts/release.js](https://github.com/s-elo/vue3-core/blob/main/scripts/release.js)脚本，其中包括版本的更改(每次发布所有包一起同步发布)，打 git tag 以及最终的 npm 发包。发包的版本支持灰度处理(canary)。

```json
{
  "release": "node scripts/release.js",
  "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s"
}
```

以上就是两个相关的命令，主要就是执行`scripts/release.js`脚本，其中`changelog`已经包含在了脚本执行里。

## 基本参数

和`dev.js`, `build.js`脚本一样，我们可以通过参数控制脚本的执行。

- `--preid`: 为准备版本的类型`prepatch, preminor, premajor, prerelease`加上的标识，**灰度忽略此参数**
  ```bash {6-9}
  pnpm release --preid=beta
  # 可选版本类型即对应版本
  patch (3.3.3)
  minor (3.4.0)
  major (4.0.0)
  prepatch (3.3.3-beta.0)
  preminor (3.4.0-beta.0)
  premajor (4.0.0-beta.0)
  prerelease (3.3.3-beta.0)
  custom
  ```
- `--dry`: 执行一遍基本流程，但不实际执行命令，主要用于开发调试；默认为`false`
- `--skipTests`: 是否跳过测试(pnpm test run); 默认为`false`会包含检查 ci 的通过情况
- `--skipBuild`: 是否跳过`pnpm build --withTypes && pnpm test-dts-only`；默认为`false`
- `--canary`: 是否发布灰度版本；为`true`时版本格式为`3.yyyyMMdd.0`；优先级比指定的版本高；如会忽略指定版本而使用灰度的版本号`node scripts/release.js 3.3.3 --canary -> x.yyyymmdd.x`；其次为`true`时相当于**skipPrompts**和**skipGit**
- `--skipPrompts`: 是否跳过选择版本号的提示；默认为`false`，即在没有指定版本时会提示选择
- `--skipGit`: 是否执行 git 操作，包括一下命令
- `--tag`: 发布到 npm 的 tag

  ```bash
  # 提交版本变更代码
  git diff
  # 如果有改变
  git add -A
  git commit -m"release: v<发布的版本号>"

  # 打tag和推送代码
  git tag v<发布的版本号>
  git push origin refs/tags/v<发布的版本号>
  git push
  ```

## 发布流程

接下来我们看一下整体的发布流程

### 确定发布的版本号

确定版本的过程分为三种情况：

- 指定版本号：`node scripts/release.js 3.3.3`, 此时版本号就为`3.3.3`
- 未指定版本号：`node scripts/release.js`, 会提示选择对应版本号
- 指定版本号的灰度发布：`node scripts/release.js 3.3.3 --canary`, 此时版本号为` 3.yyyymmdd.3`, 其中`yyyymmdd`为发布时当前机器的年月日

#### 提供的版本号

部分相关代码如下：

```js {7,13,26}
const versionIncrements = [
  'patch',
  'minor',
  'major',
  ...(preId ? ['prepatch', 'preminor', 'premajor', 'prerelease'] : [])
]
const inc = i => semver.inc(currentVersion, i, preId)

const { release } = await prompt({
  type: 'select',
  name: 'release',
  message: 'Select release type',
  choices: versionIncrements.map(i => `${i} (${inc(i)})`).concat(['custom'])
})

if (release === 'custom') {
  const result = await prompt({
    type: 'input',
    name: 'version',
    message: 'Input custom version',
    initial: currentVersion
  })
  // @ts-ignore
  targetVersion = result.version
} else {
  targetVersion = release.match(/\((.*)\)/)[1]
}
```

其中`preId`为`--preId`的值，即准备版本的标识；`inc`方法是根据版本更新的类型`versionIncrements`来推测出对应的要发布的版本号，其使用的是[semver](https://www.npmjs.com/package/semver)这个包。

此外最后会 append 一个`custom`选项去手动输入版本号。

最后如果选择的是提供的选项，通过正则就可以匹配出要发布的版本了：`patch (3.3.3)` -> `3.3.3`.

#### 灰度发布

如果有指定灰度发布`--canary`, 那么不管是否提供指定版本，最终都会处理为灰度发布的版本格式，且发包的名字为灰度包名格式：`vue` -> `@vue/canary`；`其他核心(@vue开头)包` -> `包名--canary` 如： `@vue/runtime-core` -> `@vue/runtime-core--canary`。

首先获取当前机器的时间(UTC date -> yyyyMMdd)，接着主要对`patch`版本做递增：如**当天**当前的灰度版本为`3.yyyyMMdd.1`，那么此次发布的灰度版本就是`3.yyyyMMdd.2`，如果**当天**未发布过，此次发布的灰度版本就是`3.yyyyMMdd.0`。

为了防止在当天重复发布多个相同`patch`版本的包，会有个检查过程；一开始的`canaryVersion`的`patch`版本号为`0`。

```js{5,11}
// 改成灰度命名格式，这里只是用vue包来获取当天已经发布的灰度版本，因为所有包版本都应该是同步的
const pkgName = renamePackageToCanary('vue')
const { stdout } = await run(
  'pnpm',
  ['view', `${pkgName}@~${canaryVersion}`, 'version', '--json'],
  { stdio: 'pipe' }
)
let versions = JSON.parse(stdout)
versions = Array.isArray(versions) ? versions : [versions]
const latestSameDayPatch = /** @type {string} */ (
  semver.maxSatisfying(versions, `~${canaryVersion}`)
)
canaryVersion = /** @type {string} */ (semver.inc(latestSameDayPatch, 'patch'))
```

其中`pnpm view vue/canary@~3.yyyymmdd.0 version --json`用来获取当天已经发布的灰度版本号，如已经发布了`3.yyyymmdd.1`和`3.yyyymmdd.2`，那么`versions`就为`['3.yyyymmdd.1', '3.yyyymmdd.2']`。

`semver.maxSatisfying`用于获取版本数组中满足`~canaryVersion`的最大的版本号，即**当天**的`patch`的最大版本，上面例子就是`3.yyyymmdd.2`，所以此次发布的灰度版本应该为`3.yyyymmdd.3`。

### 检查测试

如果没有指定`--skipTests`，在执行测试(pnpm test run)前会先通过调用`github CI`api 检查此次发版的提交(git rev-parse HEAD)是否已经通过了`CI`，如果通过了就提示是否要跳过本地测试的执行，因为`CI`上面已经执行过一遍通过了。

### 更新 package.json 的版本

根据确定好要发布的版本号更新每个包里`package.json`里的`version`; 首先更新根目录下的`package.json`，接着遍历所有包来更新其`package.json`以及更新其`dependencies`和`peerDependencies`下的依赖包(vue 相关的核心包)的`package.json`。

需要特殊处理的是**灰度发布**时的版本更新，前面说到[灰度发布](#灰度发布)会用特定标识灰度的格式重命名包名，所以对于`dependencies`和`peerDependencies`下的依赖包，我们需要通过`npm:<package name>@<package version>`的方式额外指定**包别名**。

如对于`vue`包

```json{11}
// 发布前
{
  "dependencies": {
    "@vue/runtime-dom": "3.3.2",
  }
}

// 灰度发布后
{
  "dependencies": {
    "@vue/runtime-dom": "npm:@vue/runtime-dom--canary@3.yyyymmdd.0",
  }
}
```

### 打包构建

如果未指定`--skipBuild`和`--dry`, 接下来会执行一遍打包构建出要发布的实际代码，即`pnpm run build --withTypes && pnpm test-dts-only`。

### 生成 changelog

接着执行`pnpm run changelog`来通过[conventional-changelog](https://www.npmjs.com/package/conventional-changelog)来生成对应的 changelog，其会自动识别更新的`commit message`里提取信息写进`CHANGELOG.md`里

### 更新 pnpm-lock.yaml

如果是**非灰度**版本，会执行一下更新`pnpm-lock.yaml`的操作，即[pnpm install --prefer-offline](https://pnpm.io/zh/cli/install#--prefer-offline)

### 发包和 git 同步

最后就是提交代码之后将更新好的代码发布(只发布 public 包)到 npm，然后打上发布版本的 tag 并将代码 push 到 github。

其中发布的命令是`pnpm publish --tag <alpha/beta/rc> --access public`，其中`tag`是只有在`alpha/beta/rc`版本才有，或者可以通过参数`--tag`指定。
