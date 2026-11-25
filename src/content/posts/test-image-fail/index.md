---
title: "图片加载失败测试"
date: 2026-07-30
tags: ["test"]
draft: false
---

## 正常图片（应成功加载）

![正常加载的图片](attachments/csapp-cover.png)

## 错误路径图片（应显示失败占位）

<img src="attachments/does-not-exist.png" alt="本地不存在的图片">

## 窄幅图片加载失败

<img src="attachments/does-not-exist.png" alt="窄幅加载失败的图片" width="200" height="20">

## 带链接的远程无效图片（应显示失败占位）

[![远程加载失败的图片](https://invalid.example.com/not-found.png)](../../notes/)
