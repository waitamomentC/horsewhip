---
version: 1.0
name: Horsewhip-design
description: "Developer tool UI — horizontal git timeline + file rail. Based on Linear dark-canvas patterns from awesome-design-md."

colors:
  primary: "#5e6ad2"
  on-primary: "#ffffff"
  accent: "#5e6ad2"
  ink: "#f7f8f8"
  ink-muted: "#8a8f98"
  ink-subtle: "#62666d"
  canvas: "#010102"
  surface-1: "#0f1011"
  surface-2: "#141516"
  hairline: "#23252a"
  inverse-canvas: "#ffffff"
  inverse-ink: "#111111"
  semantic-danger: "#e5484d"

typography:
  body:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: 400
  mono:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: 400

rounded:
  sm: 6px
  md: 8px
  lg: 12px

spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
---

## Overview

horsewhip 是 **开发者工具**，不是营销页。视觉参考 [Linear](https://linear.app)（来自 [awesome-design-md](https://github.com/VoltAgent/awesome-design-md)），核心：

- **Canvas** `#010102` — 近黑底，带极淡蓝调
- **Surface ladder** — 文件栏 / 面板用 `#0f1011`，hairline 边框 `#23252a`
- **单一强调色** — Lavender `#5e6ad2` 仅用于 HEAD、主按钮、当前版本
- **泳道图** — 多色 HSL 区分 folder，不抢主色；图为主舞台

## Layout

| 区域 | 说明 |
|------|------|
| Header 56px | demo / paste / generate · filter · cmd chip |
| File rail 148px | 文件夹树，与 graph Y 轴对齐 |
| Graph stage | 水平时间轴 · 泳道 · 圆点 commit |
| Modal / panel | surface-1 + hairline，mono 命令块 |

## Graph

- 横轴 = DAG 时间（左旧右新）
- 纵轴 = 文件 / folder / 分支子泳道
- HEAD = accent 空心环 + 实心点
- 历史 = 泳道色实心点，连线 2.5–3px
- 主线底部 V1…Vn + 短 hash

## Do

- 默认 dark；light 模式保留但 secondary
- 按钮 primary 用 accent；secondary 用 surface-1 + hairline
- 字体：Inter body · JetBrains Mono 命令/hash

## Don't

- 不用渐变 blob / 玻璃拟态
- accent 不铺满大背景
- 不用 Git Graph 第三方引擎

## Reference

- 完整 DESIGN.md 库：`.ref/awesome-design-md/`
- 主要借鉴：`design-md/linear.app/DESIGN.md`
