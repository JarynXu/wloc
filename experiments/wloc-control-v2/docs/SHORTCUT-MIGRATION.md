# 使用本地控制页与迁移旧快捷指令

## 先用控制页，不必先改旧快捷指令

安装并启用本套件对应的整合模块后，在 Safari 打开：

```text
https://wloc-settings.invalid/wloc-control/v2/
```

这份页面设计为由 Shadowrocket 的本机脚本返回。页面打开后，可直接使用“保存”“读取已存位置”“清除”和“恢复首次修改前状态”。打开页面本身不会读取或修改已存位置；读取成功会把已存位置填入表单，不会自动保存。

“恢复”使用首次由本控制功能修改前的备份，不是最近一次保存前的状态。若首次备份中没有位置，恢复后也没有已存位置。只有结果中的 `canRestore` 为 `true` 才有可恢复备份。

恢复会覆盖当前已存位置，包括其它快捷指令或客户端后来保存的值。存在并发修改时，不能保证无损撤销其它客户端的写入；执行恢复前应先读取并核对当前状态。

此入口依赖本机模块、HTTPS 解密和脚本加载正常，不是一个已部署的公网网站。`.invalid` 域名能否进入当前设备的拦截流程、Shadowrocket 的脚本与拒绝规则先后顺序，仍需真机确认。页面打不开时，不要关闭证书校验、删除 REJECT、换成公共网站域名或 HTTP。

保存、清除、恢复成功只确认本地存储已回读核对，不表示系统定位已经采用该结果。

## 可选：做一个打开控制页的快捷入口

在“快捷指令”中手工新建两项操作：

1. “URL”：填入上面的固定控制页地址。
2. “打开 URL”：使用前一步的 URL。

如果当前编辑器允许直接在“打开 URL”中填写地址，也可只用这一项。这个入口只打开页面，不接收地图分享、不解析地图链接，也不自动保存位置。它不代表原地图分享快捷指令已经迁移。

Apple 说明了 [URL 与“打开 URL”操作的组合](https://support.apple.com/zh-cn/guide/shortcuts/apd68802640c/9.0/ios/26)。本套件没有生成、签名或发布可直接导入的 `.shortcut` 文件。

## 可选：只迁移旧地图流程最后的保存请求

保留当前快捷指令已有的分享输入、地图链接解析和坐标转换。找到最后一次向 `gs-loc.apple.com` 或 `gs-loc-cn.apple.com` 的 `/wloc-settings/save` 发请求的动作，只替换这次请求及其成功判断。不要再次转换已经转换过的坐标，也不要通过新域名重新获取当前位置。

在“获取 URL 内容”中设置：

- URL：`https://wloc-settings.invalid/wloc-control/v2/save`，固定不变，不拼接查询参数。
- 方法：`POST`。
- 标头：`Content-Type` 为 `application/json`。
- 请求正文：`JSON`。
- `longitude`：原流程最终经度变量，类型为数字。
- `latitude`：原流程最终纬度变量，类型为数字。
- `accuracy`：原流程使用的精度，类型为数字；没有其它要求时可用整数 `25`。
- `randomRadius`：原流程使用的随机半径，类型为数字；不需要随机偏移时用 `0`。

正文必须是只含这四个键的 JSON 对象。经度范围为 −180 至 180，纬度为 −90 至 90；精度须为 1 至 100000 的整数，随机半径为 0 至 5000。四项都必须是有限数字，不能是数字字符串、空文本或包含单位的文字。不要把整个 JSON 对象再包装成一个文本字段，也不要选择“表单”。

Apple 的 [“获取 URL 内容”API 指南](https://support.apple.com/en-euro/guide/shortcuts/apd58d46713f/ios)确认：切换到 POST 后可选择 JSON 请求正文，并使用前面动作的变量。该说明支持上述手工配置方式，不证明本套件已通过 iOS 真机验证。

不要保留旧 Apple GET 请求作为失败回退，也不要在超时后自动重复保存。旧链接或旧捷径不会因安装本模块而自动更新。

## 读取、清除、恢复的请求

三项均使用 `POST`，标头为 `Content-Type: application/json`，JSON 正文为一个空对象 `{}`：

```text
https://wloc-settings.invalid/wloc-control/v2/query
https://wloc-settings.invalid/wloc-control/v2/clear
https://wloc-settings.invalid/wloc-control/v2/restore
```

如果快捷指令编辑器不能保证空 JSON 对象的序列化，不要改用 GET、文本表单或 URL 参数，直接使用控制页对应按钮即可。“清除”和“恢复”应保留用户确认，尤其不能在请求失败后自动清除。

## 如何判断结果

返回必须是 JSON，且 `protocol` 为 `wloc-local-control/2`。不能仅根据页面打开、HTTP 状态码或“获取 URL 内容”动作结束就显示“保存成功”。

- `success: true`：读取 `state`、`target` 和 `canRestore`。`state` 为 `saved` 时，`target` 是包含上述四个数字的对象；`state` 为 `empty` 时，`target` 为 `null`。
- 保存、清除、恢复还必须返回 `verified: true`，表示本地存储已回读核对。保存时还应核对 `target` 与刚提交的四个数字一致；清除时应为 `state: empty`。
- `success: false` 且 `outcome: not-written`：这次操作没有写入目标存储。保留原流程，不自动尝试其它地址。
- `outcome: unknown`，或遇到超时、TLS 错误、连接中断、无响应、格式不符合协议：结果不能确认，存储可能已经改变。先通过控制页“读取已存位置”核对，不自动重试写入。

`verified` 不表示 TLS 出口已经审计，也不表示 locationd 或其它 App 已采用目标位置。固定 `.invalid` 地址与 POST JSON 可以避免把坐标拼进 URL；宿主发生故障时是否会建立出站连接，仍不能仅凭本地脚本代码保证。

## 旧快捷指令的核实范围

此版本没有附带现有地图分享快捷指令的原始动作文件。上述内容是末尾 HTTP 请求的迁移规则，不是逐项核实过的动作编辑清单；不同设备上的版本与变量名称可能不同。

若要精确到用户现有快捷指令的变量和动作，需要其导出文件，或只展示末尾 URL、请求正文和结果判断动作的截图；真实坐标及其它私人内容可遮住。这不影响先使用控制页。

[Apple 的快捷指令分享说明](https://support.apple.com/en-il/guide/shortcuts/-apdf01f8c054/ios)提供导出文件与 iCloud 分享方法，并说明面向任何人的文件分享会交给 Apple 验证。当前没有执行导出、上传、签名或替换旧 iCloud 链接。
