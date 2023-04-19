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





# webpack配置文件



* 因为我们的react项目是要在服务端打包并执行，js代码的运行环境是`node`环境，所以配置`target: "node"`表示打包输出`node`环境下运行的js代码。
* 使用`babel-loader`接入[Babel](https://juejin.cn/post/7223407070963187771)来处理`js`代码。
* 使用[webpack-node-externals](https://juejin.cn/post/7223644725835644989)插件进行构建优化。