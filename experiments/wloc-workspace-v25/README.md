# WLOC v2.5 定位测试候选

这是一个完整替换模块：**已审查的 v2.4 保存修正控制脚本 + 新的定位响应适配器**。模块名称为 `WLOC Local Workspace v2.5 - Typed Location`。网页仍显示“本机控制 · v2.4 保存修正”，这是有意保留的控制页版本，不表示装错了 v2.5 模块。

当前没有真机定位成功结论，不保证解决证书问题或让系统采用目标位置。仅发布在原有测试分支的新目录，main、旧模块及旧固定链接不变。安装与一次验证流程见 [INSTALL.md](./INSTALL.md)。

## 本轮改了什么

- 保存继续使用 v2.4 的无正文 POST，目标不放在 URL 中。读取、清理、恢复和首次备份保留；不迁移或主动覆盖已保存坐标。
- 定位按完整 ARPC v1 头、32 位长度和响应类型解析。补齐 GSM、CDMA、SCDMA，以及 type 3 的 EVDO；一次响应所有完整经纬度对使用同一目标。
- 对 Shadowrocket 响应使用顶层二进制返回。没有修改时只提交空对象，避免破坏原响应。
- 使用 pako 2.1.0 校验 gzip 与 DEFLATE，限制累计解压体积。未知类型、LZ4、损坏数据或超过上限的响应原样透传。
- 不新增 MITM 主机，不改证书、不关闭证书验证、不改代理模式。控制域名保留原有 REJECT 规则；这不保证代理在脚本运行前从未尝试连接上游，也不能控制代理自身的日志。

解析器只读本机设置，不联网、不发通知、不输出位置日志。控制端写入仍需用户点击。设置坐标位于本机请求头，代理软件本身仍可能记录头部，不能称完全没有日志风险。

## 验证范围

定位开发测试 232 项通过，其中独立 protoc 协议 oracle 81 项、独立宿主边界 25 项。发布组合另外用同一存储执行保存 → 读取 → 定位改写，以及清理、恢复和压缩失败，36 项通过。所有数据均为合成，没有使用真实设备坐标或标识。

仓库内可运行 `node --test tests/*.test.mjs` 复核组合测试；需要重新构建定位脚本时运行 `npm ci`、`npm run build`。控制脚本为已发布 v2.4 的原字节副本，不在本目录重建。

已核对的代码问题不等于用户手机的故障原因：客户端若先拒绝 TLS 证书，响应脚本没有明文可改；即使改包成功，GPS、缓存及其它来源仍可能使地图显示实际位置。未知协议透传时也可能保留实际网络位置，不能把此候选用于需要保证隐藏位置的用途。

## 来源与兼容证据

- 协议 schema 与 ARPC 映射：[ios-protobuf-decoding 固定提交](https://github.com/doug-leith/ios-protobuf-decoding/tree/231b2467e61d741fdd39e1c99229e90d7e93d4c9)。资料来源包含旧版 iOS 二进制恢复，不是 Apple 的当前兼容保证。
- 响应顶层格式：[Surge 官方文档](https://manual.nssurge.com/scripting/http-response.html)、[Stash 官方文档](https://stash.wiki/en/script/rewrite-requests)。
- Shadowrocket 二进制顶层返回：[脚本维护者的实机报告](https://github.com/Maasea/sgmodule/issues/27#issuecomment-1751692491)。这不是对用户当前版本/引擎的实测。

本模块以 Shadowrocket 为目标。解析代码有 Surge/Stash 分支，但本文件不是它们原生配置的通用安装包，也不宣称 Quantumult X、Loon、Egern 兼容。

制品 SHA256：

- 控制脚本：`4de93aba317f546219e9a28102228da57897684a6494874eed1a2d40f2395af5`
- 定位脚本：`4340a44d89edf961446e835a5b555a1167bb3eab4e94ee5635cb2932ceb0d481`

pako 许可证随脚本和 `licenses/` 保留。
