const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("服务器返回的get数据");
});

app.listen(80, () => {
  console.log("服务器启动成功");
});
