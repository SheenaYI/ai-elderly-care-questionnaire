# AI养老监测 DCE 交互式原型

《智能养老AI监测中的安全、隐私与自主性权衡研究》的单页离散选择实验（DCE）网页原型。它只包含第 1 题的 A/B 对比，不会登录、采集摄像头、调用 AI 模型或提交真实数据。

## 本地启动

```bash
npm install
npm run dev
```

终端会显示本地地址（通常是 `http://localhost:5173`）。生产构建可使用：

```bash
npm run build
```

## 目录

```text
src/
  components/
    DCEQuestion.jsx         # 问卷页、场景说明和选择确认区
    SchemeCard.jsx          # 可复用的方案卡片
    AttributeRow.jsx        # 单个 DCE 属性区块
    SimulationModal.jsx     # 模拟弹窗与计时控制
    MonitoringScreen.jsx    # 正常 / 异常 / 通知监测画面
    EventNotification.jsx   # 配置相关的异常通知
    NotificationDetails.jsx # 配置相关的信息披露详情
    VideoPreview.jsx        # 可用视频或缺失视频占位
    ResultModal.jsx         # 不提交数据的选择确认弹窗
  data/schemes.js           # 所有 DCE 配置、属性值与统一文案
  App.jsx
  index.css
public/videos/
  fall-demo.mp4             # 可选；由研究团队后续放入的授权演示视频
```

## 放入演示视频

将获得授权的 MP4 放到：

```text
public/videos/fall-demo.mp4
```

页面通过 `/videos/fall-demo.mp4` 引用它。文件不存在时会显示“模拟事件视频”占位区域，不会导致页面报错。

## 修改 A/B 配置

在 `src/data/schemes.js` 编辑 `SCHEMES`。组件不会重复硬编码整套方案，卡片、通知对象、可披露内容和详情页都从数据推导。

例如，将某一方案改为持续详细监测：

```js
monitoringMode: 'continuous'
```

页面会自动改为“持续详细监测进行中”，并在异常后保持持续监测语义。属性可选值和对应文案位于同一文件的 `ATTRIBUTE_VALUES`。

## 当前属于模拟的功能

- 跌倒事件、14:32 时间点、状态切换及通知均为前端预设状态。
- 客厅画面是本地 CSS / 图标构成的示意，不连接摄像头或设备。
- 选择结果只停留在当前页面，不会写入数据库或发往服务器。
- 视频仅在本地素材存在时播放，不涉及任何外部媒体加载。

## 扩展为完整 12 题问卷

1. 在 `src/data/schemes.js` 为每一题创建一组 A/B 配置数据；保持三个属性键不变。
2. 在 `App.jsx` 增加当前题号与答案数组状态，并向 `DCEQuestion` 传入当前题的方案对象。
3. 在确认选择后保存 `{ taskId, chosenSchemeId }` 到本地状态，再切换到下一题。
4. 全部题目完成时再接入正式研究所需的知情同意、题目随机化和合规的数据提交流程。

在正式研究前，请另行完成伦理审查、可访问性测试、问卷随机化验证及数据安全评估。
