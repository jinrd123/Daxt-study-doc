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



## 同构

见本文目录：客户端搭建/总结



## 数据注水 & 脱水

服务端把渲染用的（异步）数据存放到`window.context`中的过程，即为注水，把数据注入到`window.context`中？

客户端渲染时（执行js脚本时），直接从`window.context`中取出数据来使用的过程称为脱水。



# webpack配置文件



* 因为我们的react项目是要在服务端打包并执行，js代码的运行环境是`node`环境，所以配置`target: "node"`表示打包输出`node`环境下运行的js代码。
* 使用`babel-loader`接入[Babel](https://juejin.cn/post/7223407070963187771)来处理`js`代码。
* 使用[webpack-node-externals](https://juejin.cn/post/7223644725835644989)插件进行构建优化。



# 开发体验优化

配置`package.json`实现热更新

~~~json
"scripts": {
  "dev": "npm-run-all --parallel dev:**",
  "dev:build": "webpack --config webpack.server.js --watch",
  "dev:start": "nodemon --watch build --exec node ./build/bundle.js"
},
~~~

首先`"dev:build"`命令即开启`webpack`的监听，打包范围内的文件有变动即重新打包；

`"dev:start"`命令即`nodemon`工具，`--watch`参数指定监听`build`文件夹下的文件变动，`--exec`指定后续执行的命令，即启动`node`服务

`dev`命令借助`npm-run-all`工具并行运行所有以`dev:`开头的命令，实现热更新。

热更新流程梳理：文件变动被`webpack`监听到，执行重新打包，从而`build`文件夹下打包产物发生改变，被`nodemon`监听到然后再次启动`node`服务。



# 客户端搭建

## 需求分析&思路确定

我们的项目说白了是一个`node`服务，通过`renderToString`方法将`React`代码转换为了对应的`html`字符串，然后通过模版字符串的形式嵌入到响应的`<html />`中，但是如果我们修改`react`代码，如`src/containers/Home/index.js`中给`<button>`添加事件回调，如下：

~~~react
import React from "react";

const Home = () => {
  return (
    <div>
      home
      <button onClick={() => alert("click")}>click</button>
    </div>
  );
};

export default Home;
~~~

这时候请求`node`服务发现事件是不生效的，原因就是`renderToString`方法只返回`React`代码对应的`html`结构，而对事件绑定等逻辑不做处理，这也非常好理解，`renderToString`方法运行在服务端`node`环境下，根本就没有dom这个概念，有怎么可能处理事件绑定呢。所以`renderToString`方法内部肯定在根据虚拟dom转字符串时把事件绑定等一些虚拟dom的属性忽略掉了，最终只生成了`html`结构。

我们现在的目标是让事件绑定相关的逻辑生效，中心思路很简单，利用`React`提供的相关方法，将我们的`react`业务代码进行处理，生成相应的处理事件绑定等逻辑的`js`文件，然后让客户端执行这个`js`文件，完成事件绑定。



## 搭建实践

首先给响应体中加一个`<script>`标签来指定包含了处理事件绑定的`js`文件。

~~~js
app.get("/", (req, res) => {
  res.send(
    `<html>
        <head>
            <title>hello</title>
        </head>
        <body>
            <div id="root">${content}</div>
            <script src="./index.js"></script>
        </body>
    </html>`
  );
});
~~~

我们通过`app.use(express.static("public"));`指定一个静态资源托管目录，当下需要做的事情就非常明确了——构造`js`文件，并存放在`public`文件夹下。

思路是创建一个`src/client`文件夹，其下`index.js`即为利用`React`提供的api生成js逻辑的地方，然后通过`webpack`对其进行处理，最终把打包后的产物命名为`index.js`并放在`public`文件夹下。

`src/client/index.js`

~~~js
import React from "react";
import { hydrateRoot } from "react-dom/client";

import Home from "../containers/Home";

hydrateRoot(document.getElementById("root"), <Home />); // 使用hydrateRoot方法生成客户端需要执行的js代码
~~~

然后再配置个`webpack.client.js`文件用于打包`src/client/`文件夹下的代码，最后再配置一下`package.json`里的`script`脚本，增加对`client`文件夹下内容的实时监听打包即可：

~~~json
"scripts": {
  "dev": "npm-run-all --parallel dev:**",
  "dev:build:server": "webpack --config webpack.server.js --watch",
  "dev:build:client": "webpack --config webpack.client.js --watch",
  "dev:start": "nodemon --watch build --exec node ./build/bundle.js"
}
~~~



## 总结

所谓服务端代码，即`src/index.js`，里面如`const content = renderToString(<Home />);`这属于服务端执行的`react`的逻辑，效果就是生成`react`代码对应的`html`静态结构。

所谓客户端（`src/client/`），其实就是让客户端（浏览器）去执行的`react`逻辑，即打包`src/client/index.js`生成的那个`js`文件，这个文件的执行，将会赋予`renderToString`方法生成的静态的`html`结构事件交互能力。

这里引出**同构**的概念，大致意思就是同一套`react`代码，当下这里就是指`Home`组件，服务端运行一次，即`renderToString`，客户端运行一次，即运行`<script src="index.js></script>"`，也就是服务端`src/client/index.js`打包生成的代码，核心逻辑就是`hydrateRoot`方法的调用。



# 引入路由同构

编写路由配置文件`Routes.js`，这就是我们常在`<App />`中写的路由配置部分：

~~~js
import React from "react";
import { Route, Routes as RouterRoutes } from "react-router-dom";
import Home from "./containers/Home";

const Routes = () => {
  return (
    <RouterRoutes>
      <Route path="/" element={<Home />} />
    </RouterRoutes>
  );
};

export default Routes;
~~~

客户端代码`@/client/index.js`，说白了就是曾经单页面应用中路由配置直接写`<Routes />`，现在用`<BrowserRouter />`组件包裹`<Routes />`：

~~~js
import React from "react";
import { hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import Routes from "../Routes";

const App = () => {
  return <BrowserRouter>{Routes()}</BrowserRouter>;
};

// 注意这里：hyrateRoot表示客户端代码的结构为在<div id="root"></div>中内层紧接着是由<BrowserRouter/>包裹的路由配置，所以下面服务端代码也要注意结构的统一
hydrateRoot(document.getElementById("root"), <App />);
~~~

服务端代码`@/server/index.js`：

~~~js
import express from "express";
import React from "react"; // 提供jsx语法支持
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import Routes from "../Routes";

const app = express();
app.use(express.static("public"));

// 这里服务端接口路由修改为"*"以接收所有前端路由请求
app.get("*", (req, res) => {
  const content = renderToString(
    <StaticRouter location={req.path}>{Routes()}</StaticRouter>
  );
	// 下面的<div id="root">中包裹的内容应该与客户端代码统一，也就是说里面紧接着就是路由配置，但是服务端的包裹<Routes />组件的是"react-router-dom/server"下面的<StaticRouter />组件，并需要将req.path提供给location属性
  res.send(
    `<html>
        <head>
            <title>hello</title>
        </head>
        <body>
            <div id="root">${content}</div>
            <script src="./index.js"></script>
        </body>
    </html>`
  );
});

app.listen(3000, () => {
  console.log("server run successfully");
});
~~~



# 抽取服务端字符串拼接的逻辑为`render`函数

`@/server/utils.js`：

~~~jsx
import React from "react"; // 提供jsx语法支持
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import Routes from "../Routes";

export const render = (req) => {
  const content = renderToString(
    <StaticRouter location={req.path}>{Routes()}</StaticRouter>
  );
  return `
        <html>
            <head>
                <title>hello</title>
            </head>
            <body>
                <div id="root">${content}</div>
                <script src="./index.js"></script>
            </body>
        </html>
    `;
};
~~~

`@/server/index.js`：

~~~js
import express from "express";
import { render } from "./utils";

const app = express();
app.use(express.static("public"));

app.get("*", (req, res) => {
  res.send(render(req)); // 返回render函数的返回值即可
});

app.listen(3000, () => {
  console.log("server run successfully");
});
~~~



# ssr只支持首次渲染的路由

创建公共组件`<Header />`进行路由导航，`@/conponents/Header.js`：

~~~jsx
import React from "react";
import { Link } from "react-router-dom";

const Header = () => {
  return (
    <div>
      <Link to="/">Home</Link>
      <br />
      <Link to="/about">About</Link>
    </div>
  );
};

export default Header;
~~~

并在两个路由组件`<About />`和`<Home />`中使用：

~~~jsx
// About.js
import React from "react";
import Header from "../../components/Header";

const About = () => {
  return (
    <div>
      <Header />
      This is About page
    </div>
  );
};

export default About;

// Home.js
import React from "react";
import Header from "../../components/Header";

const Home = () => {
  return (
    <div>
      <Header />
      home
      <button onClick={() => alert("click1")}>click</button>
    </div>
  );
};

export default Home;
~~~



打开浏览器，在`<Home />`或者`<About />`组件中我们都可以借助`<Link />`（编译为`<a />`）正常进行路由转跳，但是查看源代码发现，其实源代码一直都不变，都是我们在浏览器中首次请求的路由路径对应的组件的源代码，比如我请求`127.0.0.1:3000/about`，源码就是`<About />`组件所对应的，而请求`127.0.0.1:3000/`对应的源码就是`<Home />`组件的源码，然后应用程序内点击`<Link />`进行路由切换源码不变，**总结来说就是服务端渲染只发生在向服务端发送请求的时刻，后续web程序中的路由转跳将由js接管。**



# ssr项目架构

![ssr项目架构](./images/ssr项目架构.png)

浏览器、node服务、C++/java服务三者各司其职，浏览器负责页面渲染与js的执行，资源从node服务里获取；node服务负责从java服务里获取数据然后与自己的react组件进行结合生成页面内容以及js；而C++/java服务器专注于底层的数据获取与计算（数据库操作），出于其高性能的考虑。

其中node服务作为整个架构的中间层，针对这种架构，可以单独增加node服务的数量来解决node服务的负载瓶颈，同时架构也有缺点，做单页面应用时我们只需要关注js代码的逻辑正确行（负责纯前端内容），但现在我们前端工程师需要考虑node服务的稳定性，比如node服务死机该如何处理等，相当于把前端工程师业务领域拓展到了运维（后端）等领域。



# 引入Redux

## 初步引入（跑通代码并使用redux）

总体思路：只需要在`@/client/index.js`与`@/server/index.js`使用`redux`并且保证同构的逻辑相同即可，说白了就是给客户端的`<BrowserRouter />`和服务端的`<StaticRouter />`用`<Provider />`包裹即可，然后组件内使用`redux`提供的数据即可。分析一下为啥需要在`@/client/index.js`和`@/server/utils.js`中写基本相同的逻辑代码，而组件中使用`redux`数据就不存在代码逻辑的重复：

原因很简单，我们的核心原则就一个：`server`中通过`renderToString`方法构造并响应的`html`字符串内容所依赖的react项目结构与`client`中`hydrateRoot`生成js所依赖的react项目结构要相同，因为`server`中路由组件使用的是`<StaticRouter />`而`client`中路由组件使用的是`<BrowserRouter />`，由于他俩的结构不同，外面要加一个`<Provider />`的话代码是无法复用的，所以只能两个地方都进行修改，然后路由组件是复用的（`server`和`client`都在使用），所以路由组件中使用`redux`的逻辑只需要写一遍即可。

`@/client/index.js`：

~~~jsx
import { BrowserRouter } from "react-router-dom";
import Routes from "../Routes";
import { createStore } from "redux";
import { Provider } from "react-redux";

+ const reducer = (state = { name: "daxt" }, action) => {
+   return state;
+ };

+ const store = createStore(reducer);

const App = () => {
  return (
+   <Provider store={store}>
      <BrowserRouter>{Routes()}</BrowserRouter>
+   </Provider>
  );
};

hydrateRoot(document.getElementById("root"), <App />);
~~~

`@/server/utils.js`：

~~~jsx
import React from "react"; // 提供jsx语法支持
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import Routes from "../Routes";
+ import { createStore } from "redux";
+ import { Provider } from "react-redux";

export const render = (req) => {
+ const reducer = (state = { name: "daxt" }, action) => {
+   return state;
+ };
+ const store = createStore(reducer);

  const content = renderToString(
+   <Provider store={store}>
      <StaticRouter location={req.path}>{Routes()}</StaticRouter>
+   </Provider>
  );
  return `
        <html>
            <head>
                <title>hello</title>
            </head>
            <body>
                <div id="root">${content}</div>
                <script src="./index.js"></script>
            </body>
        </html>
    `;
};
~~~

`@/containers/Home/index.js`：

~~~jsx
import React from "react";
import Header from "../../components/Header";
import { connect } from "react-redux"; // 通过connect生成高阶函数来将store中的state（dispatch）增强到props中使用即可

const Home = (props) => {
  return (
    <div>
      <Header />
      home: This is a data -- "{props.name}" from redux
      <button onClick={() => alert("click1")}>click</button>
    </div>
  );
};

const mapStateToProps = (state) => ({
  name: state.name,
});

export default connect(mapStateToProps, null)(Home);
~~~

plus：由于`server`端与`client`端都存在`createStore`的逻辑，所以如果使用`redux-thunk`这种中间件也就需要分别在两端书写相关逻辑。



## 抽取公共逻辑（`store`相关）

`@/client/index.js`：

~~~jsx
import React from "react";
import { hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import Routes from "../Routes";
- import { createStore, applyMiddleware } from "redux";
import { Provider } from "react-redux";
- import thunk from "redux-thunk";

- const reducer = (state = { name: "daxt" }, action) => {
-  return state;
- };
  
+ import store from "../store";

- const store = createStore(reducer, applyMiddleware(thunk));

const App = () => {
  return (
    <Provider store={store}>
      <BrowserRouter>{Routes()}</BrowserRouter>
    </Provider>
  );
};

hydrateRoot(document.getElementById("root"), <App />);
~~~

服务端代码同理，删除所有创建`store`相关的逻辑，改为从`@/store/index.js`中引入，`@/server/utils.js`：

~~~jsx
import React from "react"; // 提供jsx语法支持
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import Routes from "../Routes";
- import { createStore, applyMiddleware } from "redux";
import { Provider } from "react-redux";
- import thunk from "redux-thunk";

+ import store from "../store";

export const render = (req) => {
- const reducer = (state = { name: "daxt" }, action) => {
-   return state;
- };
- const store = createStore(reducer, applyMiddleware(thunk));

  const content = renderToString(
    <Provider store={store}>
      <StaticRouter location={req.path}>{Routes()}</StaticRouter>
    </Provider>
  );
  return `
        <html>
            <head>
                <title>hello</title>
            </head>
            <body>
                <div id="root">${content}</div>
                <script src="./index.js"></script>
            </body>
        </html>
    `;
};
~~~

新建`@/store/index.js`：

~~~js
+ import { createStore, applyMiddleware } from "redux";
+ import thunk from "redux-thunk"; 

+ const reducer = (state = { name: "daxt" }, action) => {
+  return state;
+ };
+ const store = createStore(reducer, applyMiddleware(thunk));

+ export default store;
~~~



## store单例模式坑点

当前node服务使用的都是`@/store/index.js`中创建的唯一的一个`store`对象，所以会导致所有用户共享同一个`store`，所以要对`@/store/index.js`做出如下修改：

~~~js
import { createStore, applyMiddleware } from "redux";
import thunk from "redux-thunk";

const reducer = (state = { name: "daxt" }, action) => {
  return state;
};

- const store = createStore(reducer, applyMiddleware(thunk));

+ const getStore = () => {
+  return createStore(reducer, applyMiddleware(thunk));
+ };
  
- export default store;
  
+ export default getStore;
~~~

同时在客户端以及服务端代码中给`<Provider />`传递`store`实例时调用`getStore`方法，即`<Provider store={getStore()}>`



## redux中异步数据的服务端渲染

修改当前的`@/store/index.js`，创建模块化的`store`实例：

~~~js
import { createStore, applyMiddleware, combineReducers } from "redux";
import thunk from "redux-thunk";
import { reducer as homeReducer } from "../containers/Home/store"; // 引入具体组件的reducer实例

// combineReducers创建模块化store
const reducer = combineReducers({
  home: homeReducer,
});

const getStore = () => {
  return createStore(reducer, applyMiddleware(thunk));
};

export default getStore;
~~~

`@/containers/Home/store`：

~~~jsx
// index.js
import reducer from "./reducer";

export { reducer };

// reducer.js
import { CHANGE_HOME_LIST } from "./constants";

const defaultState = {
  data: "home data",
};

export default (state = defaultState, action) => {
  switch (action.type) {
    case CHANGE_HOME_LIST:
      return {
        ...state,
        data: action.data,
      };
    default:
      return state;
  }
};

// constants.js
export const CHANGE_HOME_LIST = "change_home_list";

// actions.js
import { CHANGE_HOME_LIST } from "./constants";
import axios from "axios";

export const changeHomeData = (data) => ({
  type: CHANGE_HOME_LIST,
  data,
});

export const getHomeData = () => { // 通过ajax异步获取服务端数据data，并调用changeHomeData(data)创建action后dispatch
  return (dispatch) => {
    axios.get("http://127.0.0.1:80").then((res) => {
      const homeData = res.data;
      dispatch(changeHomeData(homeData));
    });
  };
};
~~~

`@/containers/Home/index.js`：

~~~jsx
import React, { useEffect } from "react";
import Header from "../../components/Header";
import { connect } from "react-redux";
import { getHomeData } from "./store/actions";

const Home = (props) => {
  // 组件挂载之初调用props.getHomeData，相当于触发异步请求的逻辑从服务端获取数据
  useEffect(() => {
    const { getHomeData } = props;
    getHomeData();
  }, []);

  return (
    <div>
      <Header />
      <br />
      {/* 将store中的数据增强到props中后进行展示 */}
      {props.data}
    </div>
  );
};

const mapStateToProps = (state) => ({
  data: state.home.data,
});

const mapDispatchToProps = (dispatch) => ({
  getHomeData() {
    dispatch(getHomeData());
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(Home);
~~~

上诉代码的运行效果是在客户端请求了node服务后，通过js代码的执行向`127.0.0.1:80`（本地跑的另一个服务端项目，用来充当后端数据服务器）发送网络请求，同样通过js的执行对页面进行渲染，即展示出请求获取的异步数据。



### 当前需要解决的问题：

1. 异步数据并不是在`node`服务中渲染出来的，也就是说页面源代码中并没有对异步数据进行ssr
2. `node`服务此时并没有充当中间层的作用，也就是说客户端请求的目的地址仍直接是远程数据服务器。



### 项目架构梳理（插曲）

服务端代码，也就是基于`express`框架的`node`服务，打包后生成`/build/bundle.js`，我们启动项目也相当于用`node`命令运行这个`bundle.js`；客户端代码打包后的产物是`/public/index.js`，也就是生成的去“激活”静态结构的js逻辑。

我们的`node`服务通过`express.static("public")`中间件托管`public`文件夹下的资源，相当于托管了客户端“激活”静态结构要执行的js代码，而用户通过浏览器请求到的`html`资源并不是一个真正的`html`文件，而是后端返回的`html`字符串，到了浏览器渲染出了页面（对浏览器来说接收到`<html />`字符串等价于访问一个`.html`文件）。

联系：浏览器上渲染出的`html`页面里面有`<script>`标签，`src`指向的请求地址为`index.js`，即访问到了服务器上的托管的`public`文件夹下的用于“激活”静态结构的js代码，所以这里存在一个网络请求，即向`node`服务请求`index.js`文件。概括一下就是，我们的项目，说白了就是一个`node`服务端项目，然后向我们的`node`服务发请求会返回`html`字符串（浏览器收到`html`字符串等价于接收到`.html`文件），浏览器对`html`进行渲染并执行，因为里面的存在一个`<script src="index.js">`所以会触发浏览器向服务器的再一次请求，即请求`index.js`文件。



### 修复favicon.ico缺失造成的空请求问题（插曲）

上面说到，我们的浏览器收到`html`字符串与收到`.html`文件是等价的，都会根据`html`文件去执行渲染以及一些网络请求，浏览器有一个默认行为，就是在收到一个`html`文件时，会向请求的地址，也就是返回`html`文件的地址（当然也可能是一个返回`html`字符串的后端接口）为基本路径，请求`./favicon.ico`资源，作为浏览器页签最左边的小图标。

请求我们的`node`服务地址下的`favicon.ico`资源，因为我们托管静态资源的的`public`文件夹下并没有这个资源，进而也就进入了`app.get("*", () => {})`接口请求的逻辑中，所以服务端会给出没有对应的`favicon.ico`路由的提示，修复方法就是在`public`文件夹下放一个名`favicon.ico`的小图片即可。



### 异步数据ssr的实现思路

可以注意到`@/containers/Home/store/reducer.js`中初始化仓库数据时`defaultState`给`data`值设置了一个`"home data"`作为初始值，然后打开浏览器的源代码，`"home data"`是成功出现在源码中的，也就是成功进行了ssr。

我们的思路就非常明确了：**在服务端代码部分，给`renderToString`传参之前，把异步数据成功存入`store`中即可，这样`renderToString`就能顺利渲染出`store`中的数据并返回给客户端。**



### 具体实现——跑通数据流

曾经的路由配置文件`@/Routes.js`是直接对外暴露了`<Routes><Route /></Routes>`的路由结构，现在我们把这个结构拆分成一个路由配置对象`routeConfig`和`getRoutes`方法，`getRoutes`方法接收`routeConfig`对象即可生成曾经的路由组件结构，部分代码对比如下：

~~~jsx
// 曾经的Routes.js
const Routes = () => {
  return (
    <RouterRoutes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
    </RouterRoutes>
  );
};
export default Routes;

// 现在的Routes.js
export const routesConfig = [
  {
    path: "/",
    element: <Home />,
    loadData: Home.loadData,
  },
  {
    path: "/about",
    element: <About />,
  },
];

export const getRoutes = (routesConfig) => { // TODO: 增加嵌套路由子<Route />的生成
  return (
    <RouterRoutes>
      {routesConfig.map((route, index) => (
        <Route {...route} key={index} />
      ))}
    </RouterRoutes>
  );
};
~~~

之所以这样拆分，是为了以配置对象的形式，记录更多的路由信息，也就是某些路由组件的`loadData`方法，即它获取异步数据需要调用的方法，对应的就可以在`@/server/utils`的`render`方法中，`renderToString`调用之前调用要渲染的路由的`loadData`方法，从而将数据存储在`store`中，就做到了异步数据的ssr。

~~~jsx
// @/server/utils
export const render = (req) => {
  const store = getStore(); // 先提前实例化store
  fetchAsyncData(routesConfig, req.path, store); // fetchAsyncData方法三个参数的作用：1.routesConfig提供了每个路由组件的loadData方法 2.req.path即用户请求的路由地址，表明了需要进行ssr渲染的路由组件是哪个 3.store即为数据存储的容器
  const content = renderToString(
    <Provider store={store}>
      {/* <StaticRouter />就是通过req.path确定要对哪个路由组件进行ssr渲染，这里我们也要通过req.path对要ssr的组件进行异步数据获取 */}
      <StaticRouter location={req.path}>{getRoutes(routesConfig)}</StaticRouter>
    </Provider>
  );
  return `
        <html>
            <head>
                <title>hello</title>
            </head>
            <body>
                <div id="root">${content}</div>
                <script src="./index.js"></script>
            </body>
        </html>
    `;
};
~~~

当然还需要给需要获取异步数据的组件实例挂载上一个`loadData`方法，就放在组件函数身上即可（就是一个组件类的静态方法），如`Home`组件：

~~~jsx
import React, { useEffect } from "react";
import Header from "../../components/Header";
import { connect } from "react-redux";
import { getHomeData } from "./store/actions";

const Home = (props) => {
  useEffect(() => {
    const { getHomeData } = props;
    getHomeData();
  }, []);

  return (
    <div>
      <Header />
      <br />
      {props.data}
    </div>
  );
};

+ Home.loadData = (store) => {
+   console.log("store派发action来获取组件需要的异步数据");
+ };

const mapStateToProps = (state) => ({
  data: state.home.data,
});

const mapDispatchToProps = (dispatch) => ({
  getHomeData() {
    dispatch(getHomeData());
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(Home);
~~~

因为我们修改了路由配置的获取方式，当然还需要对客户端代码进行微调：

~~~jsx
// @/client/index.js
import React from "react";
import { hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
+ import { routesConfig, getRoutes } from "../Routes";
- import Routes from "../Routes";
import { Provider } from "react-redux";
import getStore from "../store";

const App = () => {
  return (
    <Provider store={getStore()}>
-     <BrowserRouter>{Routes()}</BrowserRouter>
+     <BrowserRouter>{getRoutes(routesConfig)}</BrowserRouter>
    </Provider>
  );
};

hydrateRoot(document.getElementById("root"), <App />);
~~~

最后看一下`@/server/utils.js`中对`fetchAsyncData`方法的实现：

~~~jsx
// TODO: 修改逻辑适配嵌套路由异步数据的获取，将下面的matchedRoute修改为mathedRoutes(当前只获取匹配到的一个顶层路由)
// 获取路由组件所需的异步数据填充到store中
// 这里要求组件挂载的loadData函数需要传入store实例
export const fetchAsyncData = (routesConfig, targetPath, store) => {
  const matchedRoute = matchRoutes(routesConfig, targetPath);
  if (matchedRoute.loadData) {
    matchedRoute.loadData(store);
  }
};

// TODO: 增加嵌套路由的匹配支持 & 完善重定向处理...
// 获取客户端请求路径对应的所有需要获取异步数据的路由配置项
export const matchRoutes = (routesConfig, targetPath) => {
  let ans;
  routesConfig.map((route) => {
    if (route.path === targetPath) {
      ans = route;
    }
  });
  return ans;
};
~~~

可以说实现是非常粗糙的，`matchRoutes`方法只能匹配到顶层路由，理论上来讲子路由也需要进行匹配并获取异步数据的，再者还有生成`jsx`路由结构的`getRoutes`方法，一层遍历，也是不能生成子路由（嵌套路由）的。这些都是未来需要进行完善的地方。这里为了先跑通异步数据的获取，重点暂时不放在这里。

经过上面的修改，当客户端请求`node`服务时，可以看到`node`服务成功打印出了`"store派发action来获取组件需要的异步数据"`，也就是`Home.loadData`方法正常执行了。现在我们只需要修改`loadData`的逻辑，让`store`正确获取到异步数据即可了。



### babel@6升级至最新版本(babel@7)（插曲）

执行`npx babel-upgrade --write`（先安装`babel-upgrade`工具），这个命令会修改`package.json`文件，把文件里所有的老版本的`babel`相关依赖删除更换成对应的新版本的依赖。还额外多了一些`babel-plugin`，我把他们都删去了，留下了`@babel/preset-env`和`@/babel/preset-react`两个预设配置给`babel-loader`代码就能正常运行了。

plus：`npx babel-upgrade --write`只是修改`package.json`，最后还需要重新`pnpm i`一下。

现在的`webpack.base.js`:

~~~js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
    ],
  },
};
~~~



### 修改`getRoutes`算法以支持嵌套路由的生成（插曲）

首先修改配置对象`routesConfig`，给`/about`路由增加配置`children`，增加一个重定向路由配置项与一个`/about/children`路由配置，然后修改`getRoutes`方法，旨在遍历`routesConfig`生成`jsx`结构时可以处理`children`以生成嵌套的`<Route />`结构，`@/Routes.js`：

~~~jsx
import React from "react";
import { Navigate, Route, Routes as RouterRoutes } from "react-router-dom";
import Home from "./containers/Home";
import About from "./containers/About";
import AboutChildren from "./containers/About/Children";

export const routesConfig = [
  {
    path: "/",
    element: <Home />,
    loadData: Home.loadData,
  },
  {
    path: "/about",
    element: <About />,
+   children: [
+     {
+       path: "/about",
+       element: <Navigate to="/about/children" />,
+     },
+     {
+       path: "/about/children",
+       element: <AboutChildren />,
+     },
+   ],
  },
];

- // TODO: 增加嵌套路由子<Route />的生成
- export const getRoutes = (routesConfig) => {
-   return (
-     <RouterRoutes>
-       {routesConfig.map((route, index) => (
-         <Route {...route} key={index} />
-       ))}
-     </RouterRoutes>
-   );
- };

+ export const getRoutes = (routesConfig) => {
+   const getRouteStructure = (routesConfig) => {
+     const RouteStructure = routesConfig.map((route, index) => {
+       if (route.children && route.children.length > 0) {
+         return (
+           <Route {...route} key={index}>
+             {getRouteStructure(route.children)}
+           </Route>
+         );
+       } else {
+         return <Route {...route} key={index} />;
+       }
+     });
+     return RouteStructure;
+   };
+
+   return <RouterRoutes>{getRouteStructure(routesConfig)}</RouterRoutes>;
+ };

// TODO: 修改逻辑适配嵌套路由异步数据的获取，将下面的matchedRoute修改为mathedRoutes(当前只获取匹配到的一个顶层路由)
// 获取路由组件所需的异步数据填充到store中
// 这里要求组件挂载的loadData函数需要传入store实例
export const fetchAsyncData = (routesConfig, targetPath, store) => {
  const matchedRoute = matchRoutes(routesConfig, targetPath);
  if (matchedRoute && matchedRoute.loadData) {
    matchedRoute.loadData(store);
  }
};

// TODO: 增加嵌套路由的匹配支持 & 完善重定向处理...
// 获取客户端请求路径对应的所有需要获取异步数据的路由配置项
export const matchRoutes = (routesConfig, targetPath) => {
  let ans;
  routesConfig.map((route) => {
    if (route.path === targetPath) {
      ans = route;
    }
  });
  return ans;
};
~~~

`getRoutes`方法支持`children`的渲染核心思想就是抽取生成`<Route>`的逻辑`getRouteStructure`，对于有`children`数组的配置项就递归调用`getRouteStructure(children)`并放在`<Route><Route/>`中即可，即`<Route>getRouteStructure(children)<Route/>`。

至于`About`组件的子组件`Children`，随便一定义即可，`@/containers/About/Children/index`：

~~~jsx
import React from "react";

const AboutChildren = () => {
  return <div>This is AboutChildren</div>;
};

export default AboutChildren;
~~~

并在`About`组件中使用`Children`组件：

~~~jsx
import React from "react";
import Header from "../../components/Header";
+ import { Outlet } from "react-router-dom";

const About = () => {
  return (
    <div>
      <Header />
      This is About page
+     <Outlet />
    </div>
  );
};

export default About;
~~~

经过上面的配置，客户端访问`127.0.0.1:3000/about`已经可以正确渲染出嵌套路由了，而且逻辑交互都正常。



#### bug

稍作改变，如果访问`127.0.0.1:3000/about/children`，客户端与服务端都会报错，都是因为一件事情，但服务端的报错更容易理解错误所在：

~~~
No routes matched location "/about/index.js" 
~~~

说明了客户端向服务端发送了一个请求，请求的`url`是`/about/index.js`，这就是因为`@/server/utils`的`render`函数中那个`<script src="./index.js">`所发出的请求，因为我们请求的是`127.0.0.1:3000/about/children`，基于此，`./index.js`就代表了`/about/index.js`，因为找不到这个js资源，所以就出错了。如果想让我们的应用程序支持请求`127.0.0.1:3000/about/children`而不报错，也非常简单，只需要把将`<script src="./index.js">`改成`<script src="../index.js">`即可。

这里暂时一个想到的解决方案就是写一个方法，用来甄别客户端浏览器请求的路由层级，如果顶层路由，如`127.0.0.1:3000/`或者`127.0.0.1:3000/about`，对应的`<script>`的`src`为`"./index.js"`；如果是嵌套路由，那么如上描述的，修改`src`为`../index.js`或者`../../index.js`即可。

同时由于我们生成的`<Route>`的嵌套结构中使用了`<Navigate />`组件（`<Route element={<Navigate />}`），服务端会给出一个警告：`<Navigate> must not be used on the initial render in a <StaticRouter>. This is a no-op, but you should modify your code so the <Navigate> is only ever rendered in response to some user interaction or state change.`，关于这个问题，似乎在`react-router`升级至6版本时就有人提出了相关[issue](https://github.com/remix-run/react-router/issues/7267)，当时好像根本不支持`ssr`，现在除了有这个警告之外，客户端功能完全正常，所以我认为没有必要在意。



### 具体实现——实现服务端异步数据ssr

接上面的“跑通数据流”的思路，在“跑通数据流”中，我们的`Home.loadData`函数中就是执行了一个同步的`console.log`逻辑，现在的问题关键在于`Home.loadData`中获取数据的逻辑需要给外界一个反馈，也就是说让外面知道异步数据的获取完成的如何了，这里我们对`Home.loadData`与`getHomeData(发送axios的action)`进行如下修改：

~~~js
// src/containers/Home/store/action.js
export const getHomeData = () => {
  return (dispatch) => {
-   axios.get("http://127.0.0.1:80").then((res) => {
+   return axios.get("http://127.0.0.1:80").then((res) => { 
      const homeData = res.data;
      dispatch(changeHomeData(homeData));
    });
  };
};
  
// src/containers/Home/index.js
Home.loadData = (store) => {
- console.log("store派发action来获取组件需要的异步数据");
+ return store.dispatch(getHomeData());
};
~~~

我们知道`createStore(reducer, applyMiddleware(thunk))`使用了`thunk`中间件创建的`store`可以`dispatch`一个函数，而不局限于一个`action`对象，`store`将会执行这个函数，并且这个函数可以接收到`dispatch`作为第一个参数，如上的`getHomeData`方法，说白了就是一个工厂函数，其实就完全类似于原生`redux`的`action`对象的工厂函数。

回归正题，也就是说`Home.loadData`中`dispatch(getHomeData())`的结果就是执行`getHomeData()`的返回值，也就是`getHomeData`内部`return`的函数，我们给这个函数一个返回值，即`return axios.get`，即一个`promise`，这样就相当于`Home.loadData`中的`store.dispatch(getHomeData())`就返回了`axios.get`，自然我们就可以把这个`promise`继续返回出去，这样就相当于给外界一个异步请求的反馈了。

然后就是`@/server`中的代码进行修改，旨在所有获取异步数据的`loadData`执行完毕后再`res.send`（为了保证`render`函数的返回渲染字符串的功能纯净性，把一些逻辑的位置进行了调整）

~~~jsx
// src/server/utils.js

import React from "react"; // 提供jsx语法支持
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { routesConfig, getRoutes } from "../Routes";
import { Provider } from "react-redux";

export const render = (req, store) => {
  const content = renderToString(
    <Provider store={store}>
      <StaticRouter location={req.path}>{getRoutes(routesConfig)}</StaticRouter>
    </Provider>
  );
  return `
        <html>
            <head>
                <title>hello</title>
            </head>
            <body>
                <div id="root">${content}</div>
                <script src="./index.js"></script>
            </body>
        </html>
    `;
};


// src/server/index.js

import express from "express";
import { render } from "./utils";
import getStore from "../store";
import { routesConfig } from "../Routes";
import { matchRoutes } from "react-router-dom";

const app = express();
app.use(express.static("public"));

app.get("*", (req, res) => {
  const store = getStore();
  const matchedRoutes = matchRoutes(routesConfig, req.path); // 使用"react-router-dom"提供的api
  const promises = []; // 创建一个promise数组，存放所有axios请求返回的promise
  matchedRoutes.forEach((item) => {
    if (item.route.loadData) {
      promises.push(item.route.loadData(store));
    }
  });
 	// 当所有axios请求成功，也就是所有promise都变成成功状态时进行res.send
  Promise.all(promises).then(() => {
    res.send(render(req, store));
  });
});

app.listen(3000, () => {
  console.log("server run successfully");
});
~~~

因为我们这里采用了`react-router-dom`提供的`matchRoutes`进行路由的匹配，同时采用`Promise.all`判断所有`axios`返回值的方式进行异步数据获取状态的判断，自然`src/Routes.js`中的`fetchAsyncData`方法也可以随之删除了。

经过上面的修改，我们客户端访问时，查看源代码发现异步数据已经被成功的ssr了，但是控制台报错，其中一个警告：

~~~
rning: Text content did not match. Server: "服务器返回的get数据" Client: "home data"
~~~

也就是说，现在服务端`renderToString`方法渲染静态字符串时用的`store`是存放了异步数据的`store`，但是客户端`hydrateRoot`生成js时用的是初始化的`store`，警告中的`"home data"`就是`store`初始化的值，所以造成了客户端与服务端不一致，出现报错。



### 具体实现——通过数据注水 & 脱水实现客户端数据与服务端的一致性

思路就是在服务端的`store`获取了数据之后，将`store.getState()`存放在`window.context`中以供客户端创建`store`时使用，作为客户端`store`的初始化值。这样就保证了客户端的`store`与服务端`store`数据的一致性。

~~~jsx
// src/server/utils.js
import React from "react"; // 提供jsx语法支持
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { routesConfig, getRoutes } from "../Routes";
import { Provider } from "react-redux";

export const render = (req, store) => {
  const content = renderToString(
    <Provider store={store}>
      <StaticRouter location={req.path}>{getRoutes(routesConfig)}</StaticRouter>
    </Provider>
  );
  // 在<script src="./index.js"></script>的上方插入新的<script>，说白了这个新的<script>就是服务端对客户端一种数据的传递，这个数据就是给下面的<script src="./index.js"></script>使用的。
  return `
        <html>
            <head>
                <title>hello</title>
            </head>
            <body>
                <div id="root">${content}</div>
+               <script>
+                 window.context = {
+                   state: ${JSON.stringify(store.getState())}
+                 }
+               </script>
                <script src="./index.js"></script>
            </body>
        </html>
    `;
};

// src/store/index.js
import { createStore, applyMiddleware, combineReducers } from "redux";
import thunk from "redux-thunk";
import { reducer as homeReducer } from "../containers/Home/store";

const reducer = combineReducers({
  home: homeReducer,
});

export const getStore = () => {
  return createStore(reducer, applyMiddleware(thunk));
};
 
// 单独定义一个创建客户端store的方法getClientStore，与getStore的区别就是从window对象中读取一个默认值（这个值就是服务端获取了异步数据后通过修改render函数中返回的字符串的形式传递给客户端的）
+ export const getClientStore = () => {
+  const defaultState = window.context.state;
+  return createStore(reducer, defaultState, applyMiddleware(thunk));
+ };
  
- export default getStore;
~~~

当然还需要对应的稍微改一下服务端与客户端代码创建`store`的方法引入方式以及调用方式即可。



# 实现node服务的请求代理功能

观察当下的`Home`组件，浏览器端会执行`useEffect`中的逻辑，即发送网络请求；服务端中会执行`Home.loadData`发送网络请求，两者本质上都是触发`store`的`action`，即走到如下的`axios.get`中：

~~~js
// src/containers/Home/store/actions.js
export const getHomeData = () => {
  return (dispatch) => {
    return axios.get("http://127.0.0.1:80").then((res) => {
      const homeData = res.data;
      dispatch(changeHomeData(homeData));
    });
  };
};
~~~

但这就会导致浏览器端的代码逻辑执行（打包出来的那个js文件）也会向远程服务器(`http://127.0.0.1:80`)发送请求，现在的改造目标就是让node服务对远程服务器进行代理，让浏览器端向node服务请求异步数据（node服务请求远程服务并返回给浏览器），而非直接请求远程服务器。

使用一个三方依赖完成node服务对远程服务的代理：[express-http-proxy](https://github.com/villadora/express-http-proxy)

修改`@/server/index.js`

~~~js
import express from "express";
import { render } from "./utils";
import { getStore } from "../store";
import { routesConfig } from "../Routes";
import { matchRoutes } from "react-router-dom";
import proxy from "express-http-proxy";

const app = express();
app.use(express.static("public"));

// 对以"/api"开头的请求使用proxy中间件
app.use(
  "/api",
  proxy("http://127.0.0.1", { // 将请求转发至"http://127.0.0.1"，即"http://127.0.0.1:80"
    proxyReqPathResolver: function (req) { // 函数返回值即为目标服务器上想请求的接口，我们需要借助req进行构造
      console.log(req.url); // req.url即去除/api之后的请求字段，比如浏览器请求我们这个node服务，url为http://xxx:xxx/api，那么req.url就是"/"，最终相当于请求了proxy代理的目标服务器上的"/"接口
      return req.url;
    },
  })
);

app.get("*", (req, res) => {
  const store = getStore();
  // const matchedRoutes = matchRoutes(routesConfig, req.path);
  // const promises = [];
  // matchedRoutes.forEach((item) => {
  //   if (item.route.loadData) {
  //     promises.push(item.route.loadData(store));
  //   }
  // });
  // Promise.all(promises).then(() => {
  	res.send(render(req, store));
  // });
});

app.listen(3000, () => {
  console.log("server run successfully");
});
~~~

配置好了代理后，先来验证下客户端是否能正常通过node服务获取到远程服务器的数据，修改`axios.get`的地址为`/api`，但切记如上，把`@/server/index.js`中服务端获取异步数据的逻辑注释上，因为`axios.get`使用相对路径时在浏览器和服务器上的行为是不一致的，具体来说就是`/api`在浏览器端运行，就会请求浏览器地址与相对路径的拼接的结果，但是服务器好想不是这样的，可能（因为我没验证）是会请求服务运行的目录与相对路径拼接的地址，也就是说不是请求我们的node服务了，而是去访问node服务之外的其他资源了。所以我们先把服务端获取异步数据的代码注释上。

浏览器请求我们的服务端渲染项目，网络抓包发现有一个`/api`请求，请求的地址是node服务，但是返回了远程服务器的数据。即node服务代理初步配置成功。



## 使用不同的axios实例来解决客户端与服务端请求地址的区分问题

分别在`@/client/`与`@/server/`文件夹下创建`request.js`，用来创建客户端与服务端不同的`axios`实例，这里我们只为了处理请求地址区分的问题，两实例之间只配置了`baseURL`，对于客户端实例，要向node服务发请求，所以我们使用相对路径，`baseURL`只加一个`/api`用来触发node服务的代理转发，而且经过代理中间件，`/api`字段也会被清除，也就是说使用此实例发请求时，只需要写远程服务器接口的路由即可；对于服务端的实例，直接拼接上远程服务的地址即可。这样客户端与服务端两者发送请求的url就实现了统一，都直接请求远程服务的接口url，只需要使用不同axios实例即可。

~~~js
// src/client/request.js
import axios from "axios";

const instance = axios.create({
  baseURL: "/api", // api触发本node服务的代理转发
});

export default instance;

// src/server/request.js
import axios from "axios";

const instance = axios.create({
  baseURL: "http://127.0.0.1:80", // 服务端请求baseURL设置为远程服务器即可
});

export default instance;
~~~

对于`action.js`中的异步方法，只需要判断使用哪一个axios实例即可

~~~js
import { CHANGE_HOME_LIST } from "./constants";
+ import clientAxios from "../../../client/request";
+ import serverAxios from "../../../server/request";
- import axios from "axios";

export const changeHomeData = (data) => ({
  type: CHANGE_HOME_LIST,
  data,
});

export const getHomeData = (server) => {
+ const request = server ? serverAxios : clientAxios;
  return (dispatch) => {
-   return axios.get("/").then((res) => {
+   return request.get("/").then((res) => {
      const homeData = res.data;
      dispatch(changeHomeData(homeData));
    });
  };
};
~~~

但是在`Home`组件中，注意`Home.loadData`中调用`getHomeData`时需要传入`true`，给客户端用的`getHomeData`(映射到`props`中)调用时传入`false`。

~~~js
Home.loadData = (store) => {
  return store.dispatch(getHomeData(true));
};

const mapDispatchToProps = (dispatch) => ({
  getHomeData() {
    dispatch(getHomeData(false));
  },
});
~~~

这样我们可以解开上面注释掉的服务端获取异步数据的逻辑，项目又正常进行渲染了！



### 代码优化

这样组件内派发异步的action都需要传递一个布尔值`server`来判断使用哪一个`axios`实例，为了增加代码的可维护性，`server`势必需要去除。

思路：因为我们客户端和服务端通过axios获取异步数据存放的`store`是不同的，所以我们可以从`store`的角度切入，使用`thunk`中间件提供的`withExtraArgument`方法，传给这个方法的参数，会被派发的执行函数接收，我们把`serverAxios`传递给服务端`store`，`clientAxios`传递给客户端`store`。

~~~js
// src/store/index.js
import { createStore, applyMiddleware, combineReducers } from "redux";
import thunk from "redux-thunk";
import { reducer as homeReducer } from "../containers/Home/store";
+ import clientAxios from "../client/request";
+ import serverAxios from "../server/request";

const reducer = combineReducers({
  home: homeReducer,
});

export const getStore = () => {
  return createStore(
    reducer,
+   applyMiddleware(thunk.withExtraArgument(serverAxios))
  );
};

export const getClientStore = () => {
  const defaultState = window.context.state;
  return createStore(
    reducer,
    defaultState,
+    applyMiddleware(thunk.withExtraArgument(clientAxios))
  );
};

// src/containers/Home/store/actions.js
export const getHomeData = () => {
  return (dispatch, getState, axiosInstance) => { // 第三个参数即可接收到withExtraArgument方法传递的参数
    return axiosInstance.get("/").then((res) => {
      const homeData = res.data;
      dispatch(changeHomeData(homeData));
    });
  };
};
~~~

