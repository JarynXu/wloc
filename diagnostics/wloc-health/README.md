# WLOC 只读健康探针

这个探针只用于判断固定的 HTTPS 请求能否进入 Shadowrocket 的 HTTP 脚本，并收到合成 JSON 响应。它不是定位修复补丁，也不保存、查询或清除坐标。

本目录用于独立测试分支。安装同目录的 wloc-health.module；它引用固定提交中的探针脚本。不要替换原来的定位模块。文件是否成功下载和脚本是否在你的手机执行，仍需按下面步骤核对。

## 发布后如何测试

仅安装这个独立模块，不替换原来的 WLOC 模块。模块只添加 `wloc-settings.invalid` 域名的 MITM 和 REJECT，并只为完整路径 `/health` 设置 request 脚本。它不改 Apple 的 MITM 或响应规则。

需要现有、已受信任的 Shadowrocket MITM 环境。如果没有，先停下；不要关闭证书校验或安装未知来源的证书。脚本文件将从 GitHub 下载，GitHub 会收到下载请求及通常的网络元数据。下载不包含坐标。模块固定脚本 commit，避免跟随分支变化自动换成其它版本。

在 iPhone 手工新建“WLOC 只读检查”捷径：

1. URL：`https://wloc-settings.invalid/health`，不加参数。
2. 获取 URL 内容：GET，不添加 Origin、请求体或坐标。
3. 显示结果。

预期响应为：

```json
{"service":"wloc-local-health","protocol":1,"status":"ok"}
```

运行一次，核对是否收到这段响应，并记录 iOS/Shadowrocket 版本及这一条请求的脚本执行或错误信息。没有可用日志时，只凭响应判断脚本是否返回了结果；不能据此声称没有宿主外连。

如果遇到 TLS 错误、REJECT 先拦截、脚本下载失败或结果不符，就停在这一步。不尝试保存，不改用 Apple 域，不降级 HTTP，也不删除 REJECT。出现来源拒绝时不要伪造 Origin。

测试后可以停用此模块。它没有接触持久化存储，因此没有坐标需要恢复。

## 能证明与不能证明的事

脚本通过离线 VM 正负边界测试；不读取请求体、持久化存储或设备位置，不调用网络 API，只返回固定 JSON。路由规则只匹配精确 health URL。

尚未运行真实 iOS/Shadowrocket。REJECT 与脚本执行顺序仍待真机验证，且 HTTPS 必须先通过客户端到代理的 TLS。成功响应不能证明系统 locationd 接受了代理证书，也不能证明完整定位链有效或绝对零外发。

这与完整保存候选的 `/wloc-control/v1/health` 是两个不同探针流程。当前 GitHub 安装候选使用这里更小的只读脚本，先不发布完整控制 API。
