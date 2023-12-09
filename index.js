const obj1 = { name: 'leo' }
const obj2 = { o: obj1 }

const proxy = new Proxy(obj2, {
  get(target, key, receiver) {
    console.log('root', target, key, receiver)
    const res = Reflect.get(target, key, receiver)
    return new Proxy(res, {
      get(target, key, receiver) {
        console.log(target, key, receiver)
        return Reflect.get(target, key, receiver)
      },
      set(target, key, value, receiver) {
        console.log(target, key, '@@@', value, receiver)
        return Reflect.set(target, key, value, receiver)
      }
    })
  },
  set(target, key, value, receiver) {
    console.log('root', target, key, '@@@', value, receiver)
    return Reflect.set(target, key, value, receiver)
  }
})

// console.log(proxy.o)
// console.log(proxy.o.name)
// proxy.o = 'pp'
// proxy.o.name = 'git'
// console.log(proxy.o.name)
// proxy.b = { bb: 'kk' }
// proxy.b.bb = 'oo'
console.log(proxy.prototype)
