# weibo-start-over

重头来过，清理所有微博

## 使用方法

1. 使用 chrome 打开 https://weibo.com 并登录
2. 打开调试窗口，复制以下代码至console，执行既可
```js
fetch("https://raw.githubusercontent.com/pythias/weibo-start-over/master/weibo-start-over.js")
    .then(response => response.text())
    .then(text => {
        eval(text);
        const cleaner = new cleanup();
        cleaner.start();
    });
```

## ⚠️ 注意事项

*   本脚本近期进行了代码重构，以提高其稳定性和可维护性。
*   脚本中的一些关键操作参数（例如删除延迟时间、重试次数等）已在 `weibo-start-over.js` 文件顶部定义为常量。有经验的用户可以根据自身需求谨慎调整这些参数。但请注意，不当的修改可能会影响脚本的正常运行或导致预期之外的结果。
*   **重要提示**：清理微博是一个不可逆的操作。请务必谨慎使用此脚本，并确保您了解其功能和潜在风险。建议在执行前仔细检查，以免误删重要内容。


