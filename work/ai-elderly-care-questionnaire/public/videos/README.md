# 演示视频目录

本目录用于存放研究团队**已获得授权**的模拟事件演示视频。

## 使用方法

将 MP4 文件命名为 `fall-demo.mp4` 放在本目录下：

```
public/videos/fall-demo.mp4
```

页面通过 `/videos/fall-demo.mp4` 引用它（见 `src/features/simulation/simulationScript.ts`
的 `SIMULATION_VIDEO_PATH`）。

## 缺失时的行为

文件不存在时，`VideoPreview` 组件会显示"模拟事件视频（占位）"界面，
**不会报错、不会崩溃**，也不影响问卷填写。

## 注意事项

1. **不要**提交未经授权的视频素材。视频中不得包含任何可识别个人的真实影像。
2. 视频为研究用**预设模拟素材**，不是真实监控录像，页面已明确标注。
3. 由于仓库根目录的 `.gitignore` 忽略了 `*.mp4`，如需把视频纳入版本管理，
   请由研究团队明确决定后强制添加：
   ```bash
   git add -f public/videos/fall-demo.mp4
   ```
   若视频较大，建议改用对象存储或部署平台的大文件托管，而不是提交进 Git。
4. 视频缺失时不应被视为故障：正式发放前由研究团队补齐即可。
