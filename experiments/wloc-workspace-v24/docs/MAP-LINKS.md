# 地图分享链接：只解析到草稿

v2.3 在位置工作台增加“从地图链接填入”。粘贴链接或含一个链接的分享文字，点“解析链接”，核对来源、坐标系和 WGS84 预览，再点“填入经纬度草稿”。精度与随机半径保持不变。解析和填入均不读取正式存储，不调用控制接口，也不保存位置。

## 支持什么

仅解析完整 URL 中有明确坐标、且下列格式可以识别的内容。不是所有地图 App 的分享链接都包含坐标。

| 来源 | 支持的格式 | 原值顺序 | 坐标系处理 |
| --- | --- | --- | --- |
| Apple 地图 | maps.apple.com/place 的 coordinate | 纬度,经度 | URL 不足以确定区域坐标系，必须选择已知来源 |
| Apple 地图 | 根路径的 ll、/frame 的 center | 纬度,经度 | 只作为视窗中心，另需确认；坐标系不自动猜 |
| Google 地图 | /maps/search/?api=1&query=纬度,经度；maps.google.com/?q=@纬度,经度 | 纬度,经度 | 必须选择已知来源坐标系 |
| Google 地图 | /maps/@?api=1&map_action=map&center=纬度,经度；/maps/@纬度,经度,缩放z | 纬度,经度 | 只作为视窗中心，另需确认 |
| 高德 | uri.amap.com/marker?position=经度,纬度 | 经度,纬度 | coordinate=wgs84 或 gaode；缺省按 URI 文档预选 GCJ-02 |
| 百度 | api.map.baidu.com/marker 的 location | 纬度,经度 | coord_type=wgs84/gcj02/bd09ll；缺省按 URI 文档预选 BD-09 经纬度 |
| 腾讯 | apis.map.qq.com/uri/v1/marker 的 marker=coord:纬度,经度 | 纬度,经度 | coord_type=1 为 GPS/WGS84，2 或缺省预选 GCJ-02 |

明确标记的坐标系不能在预览中改成另一种。只有缺省或不明确的坐标系可由用户选择。所有结果都需要确认坐标系；不能确认时不要猜，改为复制已知的 WGS84 经纬度。

高德、百度的海外坐标可能不同于境内默认值；供应商名称本身不能证明全球使用同一种坐标系。Apple/Google 链接也不按经纬度所在矩形自动判断中国境内或强制换算。预览说明了这一点。

## 不支持什么

- 高德 surl.amap.com、Google maps.app.goo.gl/goo.gl、百度 j.map.baidu.com 等短链，Apple maps.apple 短链、腾讯 map.qq.com/s/ 短链。本页不会访问它们或自动追随重定向。请在地图 App 中打开地点，再复制明确含坐标的完整链接或经纬度。
- 只有地点名称、POI 编号或地址的链接。不会地理编码，不按分享文字中的第一对数字猜坐标。
- 路线、多个地点、重复参数、坐标与另一 POI 标识并存。未证明参数优先级时直接拒绝。
- Google 未公开保证的 `!3d...!4d...` 内部数据格式、未列出的域名/国家域名和 App 自定义协议。
- 百度 BD09MC 米制投影、DMS 度分秒、经纬度指数写法和超范围数值。不会自动交换经纬度来凑有效结果。

## 换算边界

本地 GCJ-02/BD-09 到 WGS84 为数学近似，复用本仓库原 Worker 的纯换算公式，并增加范围与收敛检查。不调用地图厂商换算 API。算法矩形只是公式适用范围限制，不是真实国界，也不能用来识别输入坐标系。超出范围或未收敛会拒绝填入，不能把原值假装成换算成功。

输出保留最多七位小数，这不代表厘米级实地精度。测试中的已知数值和正反算只验证算术实现，不证明手机地图或地面位置精度。百度官方换算接口并不支持反向得到 WGS84；此处的逆算不是其官方服务保证。

## 隐私、交互与错误状态

- 粘贴不触发剪贴板读取 API、网络请求、外部地图或存储操作。原链接、地点文字和坐标不写入操作日志，也不放进新的请求 URL。
- 链接显示为文本，不插入 HTML，不生成可点击链接。解析成功只显示固定来源名称和数值，不回显分享标题或任意错误文本。
- 修改输入会清除旧预览。填入前再次核对输入快照，不能把修改前的预览误用到新链接。
- 选择另一坐标系会取消原确认；视窗中心需要独立确认。失败时原草稿和已存快照保持不变。
- 填入只更新经纬度，不改变精度、随机半径、已存结果或此前“保存结果未知”状态。填入完成后清空链接输入。页面刷新会丢失未保存的输入和预览。
- 面板位于保存表单之外，所有按钮有明确 type。按 Enter 不会触发保存表单。真正保存仍须用户单独点原保存按钮；POST 保存的真机故障并未由这个功能修复。
- 操作期间不能点“填入”改变草稿。没有短链在线服务或自动降级；如果未来增加在线解析，需要另行说明数据会发给谁。

## 验证与设计记录

沿用现有工作台的面板、字号、按钮、移动布局和焦点样式，不增加另一套导航或弹窗。textarea 具有可见标签、说明、错误状态，坐标系选择和确认框都有标签；状态通过文字说明，不只依赖颜色。手机输入字号为 16px，按钮最小触达高度 44px。

v2.3 的 182 项本地测试通过，其中包含地图格式、严格主机和数值边界、重复/歧义参数、短链拒绝、转换收敛、生产 DOM 预览/确认/失效、保留草稿其它字段、零请求/零写入及旧功能回归。另执行 18 项真实本地 HTTP 对照，全部只读、零写入。该版本的后端、GET 读取接口、传输协议和配对 WLOC 响应脚本没有变化。v2.4 仅保留地图功能，另调整了保存传输，详见 BODYLESS-WRITE.md。

DOM 测试不是 Safari 真机视觉检查。当前环境的真实浏览器测试受进程/环境限制，未声称完成手机排版或地图 App 分享格式全覆盖验证。v2.2 的独立 GET 读取已收到用户真机成功反馈；v2.3 新增解析交互尚待用户实际使用验证。

## 协议来源

- [Apple Unified Map URLs](https://developer.apple.com/documentation/mapkit/unified-map-urls)
- [Apple 地理坐标类型](https://developer.apple.com/documentation/CoreLocation/CLLocationCoordinate2D)
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
- [Google iOS URL scheme 与通用链接](https://developers.google.com/maps/documentation/urls/ios-urlscheme)
- [Google 坐标说明](https://developers.google.com/maps/documentation/javascript/coordinates)
- [高德 URI 标注](https://lbs.amap.com/api/uri-api/guide/mobile-web/point)
- [高德海外坐标 FAQ](https://lbs.amap.com/faq/advisory/others/39840/)
- [百度 URI API](https://lbs.baidu.com/docs/webapi?title=mapadjustment/uri/web)
- [百度坐标换算范围](https://lbs.baidu.com/docs/webapi?title=geoconv%2Fguide%2Fchangeposition-base)
- [百度海外坐标 FAQ](https://lbs.baidu.com/faq/details?id=2292&title=2580)
- [腾讯 URI 标注](https://lbs.qq.com/webApi/uriV1/uriGuide/uriWebMarker)
