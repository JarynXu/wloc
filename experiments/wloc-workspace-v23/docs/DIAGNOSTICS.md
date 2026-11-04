# 读取响应诊断

v2.1 引入了原先 `PROTOCOL_MISMATCH` 的细分类。v2.2 保留这些严格校验，并新增独立 GET 读取入口，见 [READ-ONLY.md](READ-ONLY.md)。正式存储、备份策略与定位响应脚本保持原样；不会自动重试、解开未知封装或接受校验失败的目标。

操作日志仍只有时间、动作、固定分类码与耗时，不记录响应正文、坐标、未知字段名、HTTP 头或任意异常消息。页面顶部显示“本机控制 · v2.3 地图链接”，用于区别旧页面。

## 各阶段能够说明什么

- `FETCH_FAILED`：fetch 未返回可使用的 Response。网络错误、连接重置、被拒绝的重定向等都可能产生它；该码不能单独确定原因。
- `RESPONSE_NOT_JSON`：读取或解析响应 JSON 失败。不显示响应正文。
- `REPLY_JSON_STRING`、`REPLY_NOT_OBJECT`：JSON 顶层类型不符合协议。不会尝试二次解析来绕过校验。
- `REPLY_WRAPPED_RESPONSE`：顶层没有协议标记，但存在对象型 response 与字符串型 response.body。仅描述结构，不证明封装来自 Shadowrocket。
- `REPLY_PROTOCOL_MISSING`、`REPLY_PROTOCOL_DIFFERENT`：没有预期协议字段，或它不等于 `wloc-local-control/2`。不会回显实际字段值。
- 其余 `REPLY_*`：成功标志、错误结构、状态、备份标志、目标结构/数值范围或写后确认不符合契约。完整固定名称与标签在 `web/reply-diagnostics.mjs` 统一维护。

health 检查成功只确认控制协议可响应，不能代替已存值读取。读取失败也不能证明存储为空，或推翻此前保存结果未知的状态。若前一次保存未知，先读取核对，不要连续保存、清除或恢复。

## 已验证的范围

182 项本地回归涵盖实际生成脚本、页面 DOM、原响应消费者、未知结果保护和全部新分类。另有 18 项真实本地 HTTP/Node fetch 对照，执行本候选脚本，比较原 POST、无正文 POST 和独立 GET 在合成故障下的行为，全程没有存储写入。正常读取及后端可控错误保持原协议；不同的异常 JSON 形态现在能返回不同的固定分类。

上述 HTTP 服务、存储和故障均为本地合成环境。它不是 Safari、Shadowrocket、TLS 或 iOS 定位的复现，也不能证明手机实际返回了哪一种异常结构。当前增加了只读兼容路径和诊断，不是已确认的真机修复。
