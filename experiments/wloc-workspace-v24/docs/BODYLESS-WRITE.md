# v2.4 无正文 POST 写入候选

## 为什么增加独立入口

原保存路径仍要求宿主读取请求正文。独立无正文 GET 读取已得到设备成功反馈，但旧 POST 操作仍可能返回缺少控制协议标识的 JSON。正式控制脚本的所有出口都带协议标识，因此这不是正常的“没有已存位置”响应。异常响应来自哪一层、实际写入是否发生，仅凭错误码不能确定。

本版让浏览器写操作不依赖请求正文读取。它是待验证的兼容方案，不能从 GET 成功推导 POST 或系统定位已经可用。

## 请求契约

固定源为 `https://wloc-settings.invalid`，路径只允许：

- `/wloc-write/v1/save`
- `/wloc-write/v1/clear`
- `/wloc-write/v1/restore`

三者均为 POST，不设置正文或 Content-Type。模块精确匹配这三个 URL，`requires-body=0`，不与旧规则重叠。必须提供：

- `X-WLOC-Protocol: wloc-local-control/2`
- `X-WLOC-Payload`：save 为现有四项数值组成的 JSON 对象；clear/restore 为显式 `{}`。

头名大小写不敏感；重复头名、缺失头、非字符串、超过 2048 字符、非可打印 ASCII、坏 JSON 或非法设置均拒绝。非零 Content-Length 或 Transfer-Encoding 也拒绝；处理器从不读取 body/bodyBytes。GET、HEAD、OPTIONS、其它方法、多余路径和查询参数不写入。

Origin 和 Sec-Fetch-Site 限制继续生效，无 CORS 放行。`allowMissingOrigin=true` 保留原生调用兼容，但不构成身份认证。请求固定为 no-store、omit credentials、no-referrer 和 redirect:error，不会在失败后换方法或回退旧接口。

坐标不在 URL 中，也不会进入页面操作日志。请求头仍可能被代理网络诊断看到或记录，不能称为零外发保证；保留 `.invalid`、REJECT 和 TLS 校验，不扩大拦截域名。不要分享完整请求、响应或代理日志。

## 存储与失败行为

沿用 `wloc_settings` 和 `wloc_settings_control_backup_v2`。首次实际改写前保留原始值、回读验证备份；写前再次比较正式原值，写后回读正式值。既有备份不会被覆盖。没有跨脚本原子 compare-and-set，不支持同时在多页面或旧捷径修改。

如果保存的四项数值已经相同，则直接返回 `unchanged: true`，不更改时间戳，不创建或更新备份。这也适用于保留的旧 POST JSON 接口。

保存回复未知后，页面最多发出一次独立 GET 核对：

- 四项值一致：显示“已读回与本次草稿一致的位置”，保留原始错误诊断。不声称证明某次保存请求成功。
- 不一致或读取失败：仍显示未知，不自动重发、回滚或清除。

在当前页面有未知写入结果时，save/clear/restore 都会被阻止，直到用户显式读取并核对。此状态仅在页面内存中，刷新会清除；刷新不能作为未知结果已解决的证据。请求超时后宿主仍可能晚到执行，后续读取只证明该读取时点的状态。

clear/restore 的未知结果不做自动目标匹配；query 不返回首次备份原值，因此不能拿任意可读状态证明恢复正确。每个请求等待上限 20 秒；保存后的只读核对是另一个请求。打开页面、编辑草稿和解析地图链接都不发请求。

## 验证边界

263 项本地测试通过，涵盖头部验证、正文访问陷阱、精确路由、方法/跨源拒绝、旧 POST 回归、首次备份、配对定位响应脚本及 DOM 中的未知结果/重复点击保护。测试坐标、存储和故障均为合成数据。

22 项真实本地 HTTP/fetch 对照通过，覆盖正常链路、零正文、非法头/来源/方法/路由拒绝、丢失保存回复后的单次 GET 核对，以及 GET 读取之后迟到的写入模型。Safari、Shadowrocket 的 requires-body=0 POST、头保留、脚本执行顺序与实际系统定位仍需设备反馈。没有读取或写入任何真实手机数据，也未修改 main、既有模块或定位解析算法。另有响应编码头修复，见 RESPONSE-ENCODING.md。
