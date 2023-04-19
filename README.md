# 理论知识



## CSR流程

1. 浏览器发送请求
2. 服务器返回HTML
3. 浏览器发送bundle.js（构建工具编译、打包react代码后的js文件）请求
4. 服务器返回bundle.js
5. 浏览器执行bundle.js代码，通过js完成渲染



## SSR流程

1. 浏览器发送请求
2. 服务器运行react代码生成页面
3. 服务器返回页面



## react（Vue）支持服务端渲染引起的关于虚拟dom作用的思考

我们服务端渲染web应用程序的静态字符串时使用了`react-dom`提供的`renderToString`方法：

~~~javascript
import { renderToString } from "react-dom/server";
import Home from "./containers/Home";

// ...
const content = renderToString(<Home />); // 得到Home组件对应的字符串
// ...                              
~~~

其实`react`能提供`renderToString`这个方法，以及`Vue`提供`SSR`的能力，都是得益于虚拟dom体系的，所谓虚拟dom就是真实dom的一个`js`对象映射，所以我们可以在服务端（非浏览器环境下）获取真实dom的对应字符串，换句话说，`renderToString`方法，就相当于是虚拟dom到dom字符串的一个映射，它的实现，是离不开虚拟dom的。

新旧虚拟dom对比，可以更精确的对真实dom进行dom操作，从而提升渲染性能，但是，从上面可知，基于虚拟dom，使我们的`Vue`、`React`框架具有了更强的跨平台能力，专业点来说就是**虚拟dom解耦了 UI 的渲染和底层平台相关的细节**。就拿`Vue`的源码来说，`runtime-core`模块提供了`h`函数与`renderer`函数（`render`函数的工厂函数），而`runtime-dom`则提供了浏览器环境（平台）下dom渲染的具体细节以及基于这些细节的`render`函数实例。这就是为啥可以用`React ｜ Vue`开发浏览器、移动端、桌面应用、小程序的原因。



## CSR & SSR 利弊对比

基于ssr的角度来说，优点是显而易见的，首屏速度快和更好的seo支持。但是因为ssr时，React代码在服务器上执行，消耗的是服务器端的性能，所以最直接的缺点就是服务器负载大



# webpack配置文件



* 因为我们的react项目是要在服务端打包并执行，js代码的运行环境是`node`环境，所以配置`target: "node"`表示打包输出`node`环境下运行的js代码。
* 使用`babel-loader`接入[Babel](https://juejin.cn/post/7223407070963187771)来处理`js`代码。
* 使用[webpack-node-externals](https://juejin.cn/post/7223644725835644989)插件进行构建优化。





