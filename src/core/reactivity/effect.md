# 响应式基础 API 之 effect

在[reactive](./reactive.md)方法的分析中，我们已经看了`trigger`和`track`方法的实现，接下来我们来看看用来定义`依赖`的`副作用`的 API：`effect`。

这里在强调一下命名规则：

- **依赖**：收集依赖时的`依赖`指的是 `effect` 函数里依赖的`响应式对象对应的键值`。
- **副作用**：即每个 `effect` 函数里的回调。

## 基本功能

我们先看看最简单的要实现`effect`的方式是怎么样的，然后才来看看实际 vue3 所做的其他功能和优化。

```ts{19,25}
/**
 * Registers the given function to track reactive updates.
 *
 * The given function will be run once immediately. Every time any reactive
 * property that's accessed within it gets updated, the function will run again.
 *
 * @param fn - The function that will track reactive updates.
 * @param options - Allows to control the effect's behaviour.
 * @returns A runner that can be used to control the effect after creation.
 */
export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions
): ReactiveEffectRunner {
  if ((fn as ReactiveEffectRunner).effect instanceof ReactiveEffect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }

  const _effect = new ReactiveEffect(fn)
  if (options) {
    extend(_effect, options)
    // 记录进effect scope, 这个功能后面再分析，简单说就是将多个副作用分配到一个scope下，可以更方便的批量操作，如stop effects等。
    if (options.scope) recordEffectScope(_effect, options.scope)
  }
  if (!options || !options.lazy) {
    // 执行一遍以收集依赖
    _effect.run()
  }
  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner
  runner.effect = _effect
  return runner
}
```

以上代码就是实际的实现，主要逻辑是创建`ReactiveEffect`实例以及初始化`run`一遍`effect`以收集依赖。

如果简单的理解`_effect.run()`里就是执行一遍逻辑，然后触发相关依赖的`get`方法，那么基本的`effect`函数就完成了。但是我们不禁会想到以下的问题：

- 循环触发`effect`怎么办？比如在执行某个`effect`的回调时触发了某个依赖的`get`，然后依赖的副作用里又执行了对应相同的`effect`(之前已经添加过)。
- 依赖更新怎么处理？比如里面有`if`语句，导致依赖可能减少的情况。
- 深层次依赖收集更新是不是可以优化一下？`effect`里嵌套了`effect`的情况。
- 之前提到的暂停 track 的功能咋搞的？

## 循环触发

```ts
const obj = reactive({ name: 'leo' })
effect(() => {
  // 收集依赖
  console.log(obj.name)
  // 触发副作用，这里可以通过effect !== activeEffect防止递归
  obj.name = 'pit'
})
effect(() => {
  // 收集依赖
  console.log(obj.name)
  // 触发副作用，这时包括了第一个副作用，然后接着触发，无穷匮也
  obj.name = 'leo'
})
```

以上代码体现了一种很有可能发生的循环情况。怎么解决呢？其实我们只要记录在这`整个循环`的链路过程中的所有`effects`，如果当前`effect`已经记录了，那么就说明要开始进入循环了!

实际就是通过`parent`属性来记录每个`effect`的上一个`active effect`的，然后就可以用来回溯了。

让咱们首次窥见一下`run`函数的部分实现吧!

```ts
// run 函数是ReactiveEffect类里的一个方法
function run() {
  // 没有激活的effect就不需要收集依赖了
  if (!this.active) {
    return this.fn()
  }
  let parent: ReactiveEffect | undefined = activeEffect
  // 有一小段控制暂停track的逻辑，后面咱们再看
  let lastShouldTrack = shouldTrack
  // 回溯寻找是否进入了传说中的循环之境，有的话就伸手阻止进入一下吧
  while (parent) {
    if (parent === this) {
      return
    }
    parent = parent.parent
  }

  try {
    // 记录上一次的effect
    this.parent = activeEffect
    activeEffect = this
    shouldTrack = true

    return this.fn()
  } finally {
    // 重新收集上一个effect的依赖
    activeEffect = this.parent
    shouldTrack = lastShouldTrack
    this.parent = undefined
  }
}
```

## 依赖更新处理

```ts
const obj = reactive({ name: 'leo', age: 16, useAge: true })

effect(() => {
  if (obj.useAge) {
    console.log(obj.age)
  }
  console.log(obj.name)
})

obj.useAge = false
```

可以看到在以上代码中，第一次`effect`执行收集了`age`, `useAge`和`name`依赖；在第二次时，`age`的更新触发了副作用的执行，但此时`obj.useAge`为 false，意味着我们不应该收集条件语句里的`age`依赖了。

对于以上情况，我们需要将之前的`age`依赖给清除掉；同样的，如果有新增依赖，我们需要添加此依赖。

最简单的做法就是每次执行前都清楚掉此`effect`的依赖，然后重新收集即可。这样就可以保证当前的依赖都是对的。那么我们的`run`函数就变成了这样：

```ts
function run() {
  if (!this.active) {
    return this.fn()
  }
  let parent: ReactiveEffect | undefined = activeEffect
  let lastShouldTrack = shouldTrack
  while (parent) {
    if (parent === this) {
      return
    }
    parent = parent.parent
  }

  try {
    // 记录上一次的effect
    this.parent = activeEffect
    activeEffect = this
    shouldTrack = true
    // [!code focus:2]
    cleanupEffect(this)

    return this.fn()
  } finally {
    // 重新收集上一个effect的依赖
    activeEffect = this.parent
    shouldTrack = lastShouldTrack
    this.parent = undefined
  }
}
```

其中`cleanupEffect`函数的实现就是把此`effect`相关的依赖清除掉：

```ts
function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      // 删除掉依赖里的effect
      deps[i].delete(effect)
    }
    // 清除掉所有依赖
    deps.length = 0
  }
}
```

## 深层嵌套依赖收集更新

以上的依赖更新机制简单，但效率肯定不高，依赖多的话，每次清除都耗费一定的性能。那我们能不能`增量式`的删除或者添加依赖，而不是每次都一股脑的全部清除呢？

咱们先不考虑深层嵌套的情况，如果只是`增量式`的删除或者添加依赖，我们或许可以如下实现：

```ts
function run() {
  if (!this.active) {
    return this.fn()
  }
  let parent: ReactiveEffect | undefined = activeEffect
  let lastShouldTrack = shouldTrack
  while (parent) {
    if (parent === this) {
      return
    }
    parent = parent.parent
  }

  try {
    this.parent = activeEffect
    activeEffect = this
    shouldTrack = true

    // [!code focus:3]
    // 标记之前的依赖为已经收集过的依赖
    initDepMarkers(this)

    return this.fn()
  } finally {
    // [!code focus:3]
    // 增量式删除和增加依赖
    finalizeDepMarkers(this)

    activeEffect = this.parent
    shouldTrack = lastShouldTrack
    this.parent = undefined
  }
}
```

主要是`initDepMarkers`和`finalizeDepMarkers`两个方法的配合使用。

### 标记旧依赖

`initDepMarkers`主要是标记之前的依赖为**已经收集过的依赖**

```ts
function initDepMarkers({ deps }: ReactiveEffect) {
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      // 加个标识即可，表示wasTracked
      deps[i].w = true
    }
  }
}
```

### 增量式更新依赖

`finalizeDepMarkers`最后兜底进行**增量式的删除和添加依赖**

```ts
const wasTracked = (dep: Dep): boolean => dep.w
const newTracked = (dep: Dep): boolean => dep.n

function finalizeDepMarkers(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    let ptr = 0
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i]
      if (wasTracked(dep) && !newTracked(dep)) {
        // 已经收集过的，但也没有标记成新的(即还存在)，那么就删除
        dep.delete(effect)
      } else {
        // 添加未收集过新的依赖
        deps[ptr++] = dep
      }
      // 重设标识
      dep.w = false
      dep.n = false
    }
    deps.length = ptr
  }
}
```

标识**已经收集过的依赖**是在`initDepMarkers`完成的，标识**新的依赖**是在[track](./reactive.md#track)的过程标记的：

其实只要是还需要的依赖就会标记成**新的依赖**

```ts
// ... 省略了track其他逻辑
if (!newTracked(dep)) {
  // 这里是深层嵌套使用的标记方法，目前可以直接dep.n = true即可
  dep.n |= trackOpBit // set newly tracked
  shouldTrack = !wasTracked(dep)
}
```

### 深层嵌套的优化

好了，现在**增量式的依赖更新**已经实现了，但是还是有优化空间的。准确的说也不是"优化"，而是修复**增量式更新引入的 bug**：

深层嵌套收集依赖的过程中**如何处理同个依赖的标识**？举个 🌰：

```ts
const obj = reactive({ name: 'leo' })
effect(() => {
  // dep.n = true
  consol.log(obj.name)
  effect(() => {
    if (xxx) {
      console.log(obj.name)
    }
  })
})
```

可以看到以上代码的两个嵌套`effects`收集了同一个依赖`name`，那么在标识时就会出现覆盖错乱的现象。

比如当 xxx 为 false 时，第二层 effect 是不应该收集`name`的，但是第一层的 effect 将`name`标识为了：`name.n === true && name.w === true`,
这样第二层 effect 就会直接`name.n === true && name.w === true`，且在执行完后还会重设标识，这样第一层的 effect 的标识就错乱了。

#### 位标识

怎么解决呢？为每一层的 effect 都分配一个标识位吗？不是不可以，那咱就不卖关子了，vue3 是通过**位运算**的方式给每一层的 effect 都分配了一个标识位的，且位运算开销也很小。

```ts
function run() {
  if (!this.active) {
    return this.fn()
  }
  let parent: ReactiveEffect | undefined = activeEffect
  let lastShouldTrack = shouldTrack
  while (parent) {
    if (parent === this) {
      return
    }
    parent = parent.parent
  }

  try {
    this.parent = activeEffect
    activeEffect = this
    shouldTrack = true

    // [!code focus:4]
    // trackOpBit 就是记录当前所在的层数，effectTrackDepth为当前总层数
    trackOpBit = 1 << ++effectTrackDepth
    initDepMarkers(this)

    return this.fn()
  } finally {
    // [!code focus:4]
    finalizeDepMarkers(this)
    // 恢复到上一层
    trackOpBit = 1 << --effectTrackDepth

    activeEffect = this.parent
    shouldTrack = lastShouldTrack
    this.parent = undefined
  }
}
```

`trackOpBit`和`effectTrackDepth`都是闭包变量，每层 effect 都共享的值。

上面的`trackOpBit`是一个二进制表示的值，举个 🌰：1 -> 第一层，10 -> 第二层，10000 -> 第五层

所以`effectTrackDepth`表示当前总层数，这样`trackOpBit = 1 << ++effectTrackDepth`就可以通过`trackOpBit`记录当前所在层数了：

`1 << 2 === 100 -> 第二层`

为啥要用`trackOpBit`而不直接用`effectTrackDepth`呢？因为我们对`dep.n`和`dep.w`与`trackOpBit`做位运算。即我们的标记方法就变成了这样：

```ts
const initDepMarkers = ({ deps }: ReactiveEffect) => {
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      // [!code focus:3]
      // 010 | 0100 === 110，即第二第三层都为true
      deps[i].w |= trackOpBit // set was tracked
    }
  }
}
// [!code focus:4]
// 1100 & 0100 === 0100，第三层时为true
const wasTracked = (dep: Dep): boolean => (dep.w & trackOpBit) > 0
const newTracked = (dep: Dep): boolean => (dep.n & trackOpBit) > 0

const finalizeDepMarkers = (effect: ReactiveEffect) => {
  const { deps } = effect
  if (deps.length) {
    let ptr = 0
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i]
      if (wasTracked(dep) && !newTracked(dep)) {
        dep.delete(effect)
      } else {
        deps[ptr++] = dep
      }
      // [!code focus:5]
      // clear bits
      // 1100 & ~1000 === 0100, 即把当前层的设为false
      dep.w &= ~trackOpBit
      dep.n &= ~trackOpBit
    }
    deps.length = ptr
  }
}
```

可以看到，通过位运算，我们就可以记录每一层的依赖状态了。但还有个小问题：代码运行平台貌似二进制位数有限吧？我们是不是应该限制一下？

#### 位数限制

Vue3 设置的最大值为 30，即超过 30 层的嵌套，咱就不理了，直接暴力清除所有依赖再重新收集即可。

```ts
function run() {
  if (!this.active) {
    return this.fn()
  }
  let parent: ReactiveEffect | undefined = activeEffect
  let lastShouldTrack = shouldTrack
  while (parent) {
    if (parent === this) {
      return
    }
    parent = parent.parent
  }

  try {
    this.parent = activeEffect
    activeEffect = this
    shouldTrack = true

    trackOpBit = 1 << ++effectTrackDepth
    // [!code focus:6]
    // 超过就暴力清除所有
    if (effectTrackDepth <= maxMarkerBits) {
      initDepMarkers(this)
    } else {
      cleanupEffect(this)
    }

    return this.fn()
  } finally {
    // [!code focus:5]
    // 超过就暴力清除所有，所以不需要增量式更新了
    if (effectTrackDepth <= maxMarkerBits) {
      finalizeDepMarkers(this)
    }

    trackOpBit = 1 << --effectTrackDepth

    activeEffect = this.parent
    shouldTrack = lastShouldTrack
    this.parent = undefined
  }
}
```

同样的，在[track](./reactive.md#track)处我们也做一下处理

```ts
// ... 省略了track其他逻辑
if (effectTrackDepth <= maxMarkerBits) {
  if (!newTracked(dep)) {
    dep.n |= trackOpBit // set newly tracked
    shouldTrack = !wasTracked(dep)
  }
} else {
  // Full cleanup mode.
  shouldTrack = !dep.has(activeEffect!)
}
```

这样我们就完成了深层嵌套场景的优化了。

### 暂停收集

这篇最后再来看看如何实现暂停收集的功能的：即

```ts
pauseTracking()
// ... 中间的过程都暂停依赖收集
resetTracking()
```
