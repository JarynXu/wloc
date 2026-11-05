# 响应诊断与保存核对

v2.1 引入了原先 `PROTOCOL_MISMATCH` 的细分类。v2.2 保留这些严格校验，并新增独立 GET 读取入口，见 [READ-ONLY.md](READ-ONLY.md)。v2.4 新写入入口与只读核对见 [BODYLESS-WRITE.md](BODYLESS-WRITE.md)。正式键与首次备份策略不变；不会自动重试、解开未知封装或接受校验失败的目标。

操作日志仍只有时间、动作、固定分类码与耗时，不记录响应正文、坐标、未知字段名、HTTP 头或任意异常消息。页面顶部显示“本机控制 · v2.4 保存修正”，用于区别旧页面。

## 各阶段能够说明什么

- `FETCH_FAILED`：fetch 未返回可使用的 Response。网络错误、连接重置、被拒绝的重定向等都可能产生它；该码不能单独确定原因。
- `RESPONSE_NOT_JSON`：读取或解析响应 JSON 失败。不显示响应正文。
- `REPLY_JSON_STRING`、`REPLY_NOT_OBJECT`：JSON 顶层类型不符合协议。不会尝试二次解析来绕过校验。
- `REPLY_WRAPPED_RESPONSE`：顶层没有协议标记，但存在对象型 response 与字符串型 response.body。仅描述结构，不证明封装来自 Shadowrocket。
- `REPLY_PROTOCOL_MISSING`、`REPLY_PROTOCOL_DIFFERENT`：没有预期协议字段，或它不等于 `wloc-local-control/2`。不会回显实际字段值。
- 其余 `REPLY_*`：成功标志、错误结构、状态、备份标志、目标结构/数值范围或写后确认不符合契约。完整固定名称与标签在 `web/reply-diagnostics.mjs` 统一维护。

health 检查成功只确认控制协议可响应，不能代替已存值读取。读取失败也不能证明存储为空，或推翻此前保存结果未知的状态。若前一次保存未知，先读取核对，不要连续保存、清除或恢复。

## 保存核对的固定代码

- `SAVE_UNCHANGED`：保存目标与读取的四项值一致，没有改写正式值或备份。
- `SAVE_READBACK_MATCH`：保存回复未知，随后独立 GET 读取与本次草稿一致；不是某次请求成功的证明。
- `SAVE_BLOCKED_UNCERTAIN`：当前页面仍有未知写入结果，本次写入被阻止，未发出请求。需先显式读取核对；该保护不跨刷新持久化。
- `HEADER_PROTOCOL_REQUIRED`、`INVALID_PAYLOAD_HEADER`、`BODY_NOT_ALLOWED`：新写入入口拒绝了协议头、payload 头或非空正文声明，未写正式位置。

保存未知后只自动读取一次。读取不匹配不等于写入未发生，也可能有迟到写入或其它客户端修改；读取失败不等于存储为空。清除、恢复不会自动用任意可读结果冒充恢复成功。

## 已验证的范围

本版 263 项本地回归通过，涵盖实际生成脚本、DOM、原响应消费者、头部/方法/来源拒绝、首次备份、无重复写入、未知结果保护及固定诊断。真实 HTTP/fetch 的独立验证见 BODYLESS-WRITE.md。

服务、存储与故障均为本地合成环境。它不是 Safari、Shadowrocket、TLS 或 iOS 定位的复现，也不能证明手机实际返回异常的来源。新无正文 POST 与自定义头的手机兼容性尚未确认。
