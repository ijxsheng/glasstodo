# GlassTodo 使用说明

更新日期：2026-11-28 · 首版试用 Demo

正式网址：**https://ijxsheng.github.io/glasstodo/**

## 开始使用

直接打开正式网址，不需要 GitHub 账号、GlassTodo 账号或运行 PowerShell。首次默认英文，右上角 **EN／中** 可切换语言。

请固定使用一个浏览器及其用户配置。任务和附件保存在该浏览器本地，不上传到 GitHub，也不会在 Chrome、Edge、不同电脑或不同浏览器配置之间自动同步。隐私窗口、清除网站数据或浏览器自动清理可能导致数据丢失。当前没有导入、导出和云备份，重要事项请另留一份记录。

## 安装为应用窗口（可选）

从**正式网址**安装，避免安装旧的 `127.0.0.1` 本地开发版。

- Edge：可使用地址栏的安装图标；也可在菜单中选择“更多工具 → 应用 → 将此站点作为应用安装”。菜单随浏览器版本可能变化。[Edge 官方说明](https://support.microsoft.com/en-gb/edge/install-manage-or-uninstall-apps-in-microsoft-edge)
- Chrome：可使用地址栏安装图标，或菜单“投放、保存和分享 → 将网页安装为应用”。[Chrome 官方说明](https://support.google.com/chrome/answer/9658361)
- GlassTodo 设置中的“安装与离线”会在浏览器提供安装能力时显示安装按钮；没有按钮时仍可直接使用网页。

安装版是同一个网站的独立窗口，跟随安装它的浏览器、用户配置及网址的数据。它不是桌面贴附组件，也不会在完全关闭后继续可靠地执行定时提醒。

## 任务与类别

点击“新增任务”，填写名称后保存。状态为 **To do／WIP／Pending／Done／Cancel**，这五种状态名称在两种语言里保持英文。中文版的栏目显示“已完成／已取消”，英文栏目为 Done／Cancel。

- **今天**：今天截止，或时间段覆盖今天的活动任务。
- **待办 / Upcoming**：所有活动任务，包括无日期、未来和逾期任务。
- **已逾期 / Overdue**：超过截止时间且仍为 To do／WIP／Pending 的任务。只选日期的任务次日才逾期；时间段按结束时点判断。
- **已完成／已取消**：对应 Done／Cancel 状态的任务。

点击任务名称查看详情，在详情编辑、添加进展记录或删除。删除主任务需要确认，可在“设置 → 最近删除”恢复。

类别标题旁的“＋”用于新增类别；类别旁“⋯”可重命名或删除。删除类别不会删除任务，任务会移到“其他”（删除“其他”时移到“未分类”）。优先级可选高、中、低、无，标签可自行创建；类别、状态、优先级和标签可组合筛选。

## 时间和子任务

任务与子任务均可选择：

- **不设时间**：仍能设置自定义提醒；任务在“待办”中查看。
- **截止时点**：可只选日期，也可增加具体时间。
- **时间段**：填写完整的开始、结束日期及时间，结束必须晚于开始，可跨天。

新增任务时即可添加子任务；已有任务在详情添加。父任务与子任务的状态、时间和提醒独立，完成全部子任务不会自动完成父任务。进度条显示子任务完成数量／总数量。

删除子任务需要确认，当前没有“已删除子任务”恢复入口。保存父任务前关闭新增窗口，会放弃整组未保存内容。

## 提醒

### 首次开启

首次使用会引导开启通知。点击“开启通知”后，还需在浏览器询问中选择“允许”。通常同一浏览器、同一网址只授权一次，重启电脑不用重复授权；其他浏览器需要分别允许。

也可以稍后在“设置 → 提醒”允许通知，并点击“测试通知”。“发送系统通知”开关可停止 GlassTodo 请求系统通知；真正撤销权限需在浏览器地址栏左侧的网站权限中阻止通知。

### 设置提醒时间

每个任务、子任务都要**主动设置提醒**，仅填写截止时间不会自动提醒。

| 选项 | 计算方式 |
| --- | --- |
| 无 | 不提醒 |
| 提前一小时／一天／一周 | 截止任务按截止时点计算；时间段按**开始时点**计算。一天为 24 小时，一周为 168 小时 |
| 自定义 | 自行选择完整提醒日期和时间，也适用于无截止日期的任务 |

活动任务在页面运行时约每 30 秒检查，保存任务、切回页面也会检查。Done／Cancel、已删除或已关闭提醒的任务不提醒；父任务结束或删除后，子任务提醒暂停。

**关闭所有网页及应用窗口、电脑休眠或浏览器限制后台运行时，不能保证准时弹出。** 系统勿扰模式、横幅设置和网站权限也会影响展示。无需人为隔开两个提醒的时间。

### 提醒中心

右上角铃铛打开提醒中心，红色数字表示到点后尚未处理的提醒数量，归零后角标隐藏。

- 点击单条系统通知，或中心里的“查看任务／子任务”：对应提醒视为已查看并移除。
- 多条错过提醒可能合并成一条系统汇总通知；点击汇总只打开中心，逐条查看后移除。
- 通知自动消失或直接关闭，不表示已查看；可在中心点击“忽略”。
- 不提供延迟若干分钟、每日汇总和重复任务功能。

## 进展、附件和外观

进展记录由输入文字和自动时间组成，可编辑、删除及恢复已删除记录。编辑保留原提交时间。

备注中可添加图片、Word、Excel、PPT、PDF 等常用附件。单文件最多 20 MB，每项任务最多 20 个、合计最多 100 MB。图片可预览，Office 文件下载后使用本机软件打开。附件随任务保存在浏览器，取消表单不会保存变更。

“设置 → 外观”可调透明度，数值越高越透明，范围 0%—60%，默认 10%。语言和外观保存在当前浏览器。快捷添加和对应快捷键已移除，使用“新增任务”。

## 更新、离线及常见问题

首次联网打开后，在设置确认“离线资源已就绪”，之后可使用已缓存的应用离线管理本机任务。浏览器移除缓存或存储空间不足时，离线能力可能失效。

功能更新仍使用同一网址。先保存编辑，联网打开，等待新版准备好，再关闭所有 GlassTodo 网页和安装版窗口后重开。如果仍显示旧版，在浏览器打开正式网址并按 **Ctrl＋Shift＋R**。不要为了更新清除网站数据。

| 问题 | 检查方法 |
| --- | --- |
| 桌面图标打不开或内容很旧 | 确认安装的是正式网址，不是 `127.0.0.1:5175`；从正式网址重新安装前保留旧地址数据 |
| 任务看不到 | 先切到“待办”，清除筛选；再确认浏览器、用户配置和网址是否与之前一致 |
| 提醒不弹出 | 检查任务是否主动设置提醒、是否仍为活动状态、通知权限和“测试通知”，以及 Windows 勿扰／横幅设置 |
| 网页与安装版数据不同 | 确认二者来自同一浏览器配置及同一网址；当前不支持跨浏览器同步 |
| Mac 能否使用 | 目标为网页使用，但尚未完成 Mac 实机验收；不提供原生桌面贴附功能 |

反馈问题时请附：浏览器与系统、网页还是安装版、操作步骤、期望与实际结果；提醒问题另附提醒时点、任务状态及测试通知结果。截图注意遮住个人任务和附件内容。

## English quick start

Open https://ijxsheng.github.io/glasstodo/ and use **EN / 中** to switch language. No account is required. Data stays in this browser profile and website origin; there is no cloud sync or export yet. Use one browser consistently and keep a separate record of important information.

Use **Add task** to create tasks and optional subtasks. Choose no schedule, a due date/time, or a complete time range. Statuses are To do, WIP, Pending, Done, and Cancel. Parent and subtask status are independent. Deleted parent tasks can be restored from Settings → Recently deleted; deleted subtasks have no restore entry.

Allow notifications when prompted, then use Settings → Test notification. A due date alone does not enable reminders. Advance reminders use the due time for deadline tasks and the start time for ranges. Custom reminders need a date and time. Keep the app open; delivery is not guaranteed while fully closed or asleep.

The bell badge counts unhandled reminders. Clicking an individual notification or a task link in the reminder center marks that reminder viewed. Clicking a grouped notification opens the center without clearing all entries. Use Dismiss to remove an entry. Daily summaries, repeating tasks and snooze controls are unavailable.

You may install the website through Edge or Chrome. The installed window follows the installing browser profile's data. Save edits before updating; open online, close all app windows and reopen. If stale, open the public URL in the browser and hard-refresh with Ctrl+Shift+R. Do not clear site data to update.
