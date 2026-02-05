# 源代码梳理（yuanma）

这里汇总的是“看代码得到的结构与数据流”，尽量用 **入口 → 流程 → 关键文件** 的方式把前后端串起来，并附上可点击的源码定位链接。

## 快速入口
- [00-项目总览.md](file:///f:/C/yuanma/00-%E9%A1%B9%E7%9B%AE%E6%80%BB%E8%A7%88.md)
- [10-后端-服务入口与启动流程.md](file:///f:/C/yuanma/10-%E5%90%8E%E7%AB%AF-%E6%9C%8D%E5%8A%A1%E5%85%A5%E5%8F%A3%E4%B8%8E%E5%90%AF%E5%8A%A8%E6%B5%81%E7%A8%8B.md)
- [11-后端-鉴权与Token.md](file:///f:/C/yuanma/11-%E5%90%8E%E7%AB%AF-%E9%89%B4%E6%9D%83%E4%B8%8EToken.md)
- [12-后端-RestAPI路由地图.md](file:///f:/C/yuanma/12-%E5%90%8E%E7%AB%AF-RestAPI%E8%B7%AF%E7%94%B1%E5%9C%B0%E5%9B%BE.md)
- [13-后端-Socket.IO事件与在线状态.md](file:///f:/C/yuanma/13-%E5%90%8E%E7%AB%AF-Socket.IO%E4%BA%8B%E4%BB%B6%E4%B8%8E%E5%9C%A8%E7%BA%BF%E7%8A%B6%E6%80%81.md)
- [14-后端-数据库与Redis访问.md](file:///f:/C/yuanma/14-%E5%90%8E%E7%AB%AF-%E6%95%B0%E6%8D%AE%E5%BA%93%E4%B8%8ERedis%E8%AE%BF%E9%97%AE.md)
- [20-前端-入口与路由.md](file:///f:/C/yuanma/20-%E5%89%8D%E7%AB%AF-%E5%85%A5%E5%8F%A3%E4%B8%8E%E8%B7%AF%E7%94%B1.md)
- [21-前端-鉴权状态与API封装.md](file:///f:/C/yuanma/21-%E5%89%8D%E7%AB%AF-%E9%89%B4%E6%9D%83%E7%8A%B6%E6%80%81%E4%B8%8EAPI%E5%B0%81%E8%A3%85.md)
- [22-前端-Socket连接与心跳.md](file:///f:/C/yuanma/22-%E5%89%8D%E7%AB%AF-Socket%E8%BF%9E%E6%8E%A5%E4%B8%8E%E5%BF%83%E8%B7%B3.md)
- [30-脚本与运维辅助.md](file:///f:/C/yuanma/30-%E8%84%9A%E6%9C%AC%E4%B8%8E%E8%BF%90%E7%BB%B4%E8%BE%85%E5%8A%A9.md)

## 与现有 docs 的关系
- `docs/` 更偏“功能/部署/说明书”
- `yuanma/` 更偏“按源码入口拆解出的结构图与关键调用链”

