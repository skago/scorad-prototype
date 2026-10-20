# SCORAD 评估工具 — 技术架构设计文档

> 版本：v2.0（零成本架构） · 日期：2026-10-17
> 适用范围：Web 端 + 微信小程序端
> 目标用户：皮肤科临床医生、医学科研人员、护理人员（自用 / 同学 / 同事，公益性质）
> 成本定位：**方案 A（零成本纯本地）为主，预留升级到方案 B（微信云开发免费额度）**

---

## 一、架构总览

### 1.1 设计原则

1. **端侧计算 + 端侧存储**：SCORAD 评分与数据存储全部在客户端完成，**无后端服务器**
2. **零成本运行**：静态托管免费 + 小程序个人号免费，年度基础设施成本 = 0
3. **引擎共享**：评分引擎抽取为独立 TS/JS 模块，Web 与小程序共用同一套计算逻辑
4. **隐私原生**：患者数据只存在用户自己的设备上，不上传任何服务器，天然合规
5. **可升级**：存储层抽象为 `StorageAdapter`，未来一键切换到微信云开发（方案 B），无需改业务逻辑

### 1.2 整体架构图（方案 A：零成本纯本地）

```
┌───────────────────────────────────────────────────────────────┐
│                         客户端层（全部本地）                    │
│                                                                 │
│  ┌────────────────────┐          ┌─────────────────────────┐   │
│  │     Web 端          │          │    微信小程序端          │   │
│  │  静态托管 (免费)     │          │  个人号 (免费)           │   │
│  │  Cloudflare Pages   │          │  wx.login 拿 openid     │   │
│  │  / GitHub Pages     │          │  (本地存储，不请求后端)  │   │
│  └──────────┬──────────┘          └──────────┬──────────────┘   │
│             │                                │                  │
│             ▼                                ▼                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              共享 scorad-engine（纯计算）                  │   │
│  │   calculate() / normalizeInput() / classifySeverity()    │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │           StorageAdapter（存储抽象层，可切换）              │   │
│  │  ┌─────────────────────┐  ┌───────────────────────────┐  │   │
│  │  │ LocalStorageAdapter │  │  CloudStorageAdapter       │  │   │
│  │  │ (方案 A 默认)        │  │  (方案 B 预留，未启用)      │  │   │
│  │  │ Web: localStorage   │  │  微信云开发云数据库         │  │   │
│  │  │ 小程序: wx.storage  │  │  (免费额度内)               │  │   │
│  │  └─────────────────────┘  └───────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  无后端 · 无数据库 · 无 Redis · 无运维                            │
└───────────────────────────────────────────────────────────────┘

   静态资源分发（Web 端）：
   用户浏览器 ──HTTPS──▶ Cloudflare Pages / GitHub Pages (免费 CDN)
```

### 1.3 方案 A vs 方案 B 对比

| 维度 | 方案 A（当前默认） | 方案 B（未来可升级） |
|------|-------------------|---------------------|
| 后端 | 无 | 微信云开发云函数（免费额度） |
| 数据库 | 无（本地存储） | 微信云开发云数据库（2GB 免费） |
| 数据同步 | 仅本机 | 多设备 / 多人共享 |
| 成本 | 0 元/年 | 0 元/年（免费额度内） |
| 切换方式 | — | 仅替换 `StorageAdapter` 实现，业务代码不变 |

---

## 二、技术选型

### 2.1 客户端

| 层 | Web 端 | 微信小程序端 | 说明 |
|----|--------|-------------|------|
| 框架 | Vue 3 + TypeScript | Taro 4 + React + TypeScript | Taro 可与 Web 共享业务逻辑 |
| 构建 | Vite 5 | Taro CLI (Webpack 5) | — |
| UI 组件库 | Element Plus | Taro UI / NutUI | 统一医疗蓝白风格 |
| 图表 | ECharts 5 | ec-canvas | 受试者趋势图（本地数据） |
| 状态管理 | Pinia | Zustand | — |
| 评分引擎 | `scorad-engine`（共享） | `scorad-engine`（共享） | 同一套计算逻辑 |
| 存储 | `StorageAdapter` → LocalStorage | `StorageAdapter` → WxStorage | 抽象层统一接口 |

### 2.2 托管与发布

| 项 | 方案 | 成本 |
|----|------|------|
| Web 静态托管 | Cloudflare Pages（推荐）或 GitHub Pages | 免费（含 HTTPS + CDN） |
| 域名 | 平台自带 `*.pages.dev`，或自有域名（可选） | 免费 / 60 元/年（可选） |
| SSL | 平台自动签发 | 免费 |
| 小程序账号 | 个人微信小程序账号 | 免费 |
| 小程序发布 | 微信公众平台上传审核 | 免费 |

### 2.3 无服务端组件

- ❌ 无 Node.js / NestJS 后端
- ❌ 无 PostgreSQL / MySQL
- ❌ 无 Redis
- ❌ 无对象存储 OSS
- ❌ 无 Docker / 运维

---

## 三、评分引擎（共享核心）

### 3.1 包结构

`scorad-engine` 作为独立模块（可发布为 npm 包，或在 monorepo 中以 workspace 引用），被 Web 与小程序共同依赖：

```
scorad-engine/
├── src/
│   ├── index.ts          # 对外 API
│   ├── calculate.ts      # SCORAD / oSCORAD 计算（整数运算）
│   ├── normalize.ts      # 输入校验与标准化
│   ├── severity.ts       # 严重度分层
│   ├── bsa.ts            # 体表面积表（Rule of Nines + Lund-Browder）
│   └── types.ts          # 类型定义
├── test/                 # Vitest 单元测试
└── package.json
```

### 3.2 核心计算（保持原型的整数运算，消除浮点误差）

```
a10 = round(A × 10)
c10 = round(C × 10)
SCORAD   = (a10 + 175×B + 5×c10) / 50
oSCORAD  = (a10 + 175×B) / 50
```

### 3.3 体表面积表

- **成人 Rule of Nines**：头颈 9、上肢 18、躯干 36、下肢 36、会阴 1
- **儿童 Lund-Browder**：按年龄段（0、1、5、10、15 岁）内置各部位占比数组

### 3.4 版本管理

- 算法版本：`SCORAD_CLASSIC_BASE_1.0`
- 分层版本：`SCORAD_LT25_25TO50_GT50_1.0`
- 引擎版本写入每条记录，确保可复算与溯源

---

## 四、存储抽象层（升级方案 B 的关键预留）

### 4.1 设计目标

业务代码**只依赖 `StorageAdapter` 接口**，不直接操作 `localStorage` / `wx.setStorageSync`。未来切换到云开发时，只需新增一个适配器实现，不动业务逻辑。

### 4.2 接口定义

```typescript
// shared/storage/types.ts
export interface StorageAdapter {
  // 评估记录
  listRecords(): Promise<AssessmentRecord[]>;
  getRecord(id: string): Promise<AssessmentRecord | null>;
  saveRecord(record: AssessmentRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;

  // 草稿
  getDraft(): Promise<Partial<AssessmentRecord> | null>;
  saveDraft(draft: Partial<AssessmentRecord>): Promise<void>;
  clearDraft(): Promise<void>;

  // 用户态（小程序 openid 等）
  getUser<T = any>(): Promise<T | null>;
  setUser<T = any>(user: T): Promise<void>;
  clearUser(): Promise<void>;

  // 通用配置（科研模式开关等）
  getConfig<T = any>(key: string): Promise<T | null>;
  setConfig<T = any>(key: string, value: T): Promise<void>;
}
```

### 4.3 方案 A：LocalStorageAdapter（默认启用）

```typescript
// shared/storage/LocalStorageAdapter.ts
export class LocalStorageAdapter implements StorageAdapter {
  // Web: window.localStorage
  // 小程序: wx.setStorageSync / wx.getStorageSync
  // 按运行环境自动选择
}
```

存储结构（与现有原型一致）：

| Key | 内容 |
|-----|------|
| `scorad_records_v1` | 已保存评估记录数组（JSON） |
| `scorad_draft_v1` | 当前表单草稿 |
| `scorad_user_v1` | 登录用户信息（小程序 openid） |
| `scorad_research_mode` | 科研模式开关（"1"/"0"） |

### 4.4 方案 B：CloudStorageAdapter（✅ 已实现；小程序端已启用，Web 端预留）

> **状态（2026-10-20）**：小程序端**已启用**——微信云开发免费环境 `cloud1-d1gvx0dpzae6aede6`（微信体验版）已开通，集合 `assessment_records`（仅创建者可读写）与 login 云函数已部署，端到端验证通过（保存 → 云端出现记录，`_openid` 自动写入）。Web 端仍未启用（匿名登录方案代码就绪，需单独开通 CloudBase 环境）。

采用**组合模式**（内部持有本地适配器），两端实现逐字对齐：

- **读**：永远走本地（启动时后台 pull 合并，不阻塞 UI）
- **写**：先落本地，再入离线队列（`scorad_sync_queue_v1`）后台推送云端
- **合并算法**（`storage/merge.ts` 纯函数，两端逐字一致）：
  - 按 `id` upsert；同 id 冲突时 `updated_at`（ISO 字典序即时间序）大者胜，相等保留本地
  - `created_at` / `created_by` 以首次创建为准（取两方 `created_at` 较小者的值）
  - 已知局限：云端删除无 tombstone，本地留存记录会在下次 push 时复活（单设备场景可接受）
- **触发时机**：网络恢复（`wx.onNetworkStatusChange` / `online` 事件）+ 应用回前台（`onAppShow` / `visibilitychange`）
- **失败策略**：静默同步，仅 `console.warn`，绝不影响本地使用
- **登录决策**：
  - 小程序：`login` 云函数返回 `cloud.getWXContext().OPENID`，存入 `UserInfo.openid`；云端 `_openid` 由数据库自动写入实现权限隔离（集合权限「仅创建者可读写」）
  - Web：`@cloudbase/js-sdk` **匿名登录**（`auth.signInAnonymously`，零摩擦；微信扫码需网站备案，成本不符），SDK 子路径动态引入（app/auth/database），未配置 envId 不进首屏 bundle
  - `created_by` 审计字段**保持本地 UUID 不变**（不随登录态改变）
  - **预期行为**：Web 匿名 uid ≠ 小程序 openid，两端数据各自云隔离；跨端迁移走 CSV/JSON 导入导出

**切换方式**：工厂内 `USE_CLOUD` 置 `true`（小程序另需 `src/config/cloud.ts` 填 `ENV_ID`；Web 另需 `.env.production` 填 `VITE_CLOUDBASE_ENV`）：

```typescript
// storage/index.ts（两端同构）
const storage: StorageAdapter = USE_CLOUD
  ? new CloudStorageAdapter(new LocalStorageAdapter())  // 小程序为 WxStorageAdapter
  : new LocalStorageAdapter();
```

---

## 五、数据模型

### 5.1 评估记录（与 PRD 一致）

```typescript
interface AssessmentRecord {
  id: string;                      // uuid
  assessed_at: string;             // ISO 时间
  patient_name: string;
  patient_gender: string;
  patient_age: string;
  patient_id: string;
  visit_week: string;
  // 科研扩展字段（选填）
  research_project_id?: string;
  center_id?: string;
  subject_screening_no?: string;
  evaluator_id?: string;
  evaluator_qualification?: string;
  blinding?: string;
  data_source?: string;
  bsa_mode: string;                // rule_of_nines / lund_browder
  // 评分数据
  head_neck: number;
  upper_limbs: number;
  trunk: number;
  lower_limbs: number;
  perineum: number;
  extent_a: number;
  erythema: number;
  edema_papulation: number;
  oozing_crusting: number;
  excoriation: number;
  lichenification: number;
  dryness: number;
  intensity_b: number;
  pruritus: number;
  sleep_loss: number;
  subjective_c: number;
  extent_weighted: number;
  intensity_weighted: number;
  scorad: number;
  objective_scorad: number;
  scorad_severity: 'mild' | 'moderate' | 'severe';
  // 版本
  scoring_algorithm_version: string;
  severity_classification_version: string;
  objective_scorad_mode: string;
  app_version: string;
}
```

### 5.2 存储容量约束

| 端 | 存储上限 | 记录数估算（单条约 1KB） |
|----|---------|------------------------|
| Web localStorage | ~5–10MB | 5,000–10,000 条 |
| 小程序 wx.storage | 10MB（单 key 1MB） | 建议单 key 存 500 条，分页管理 |

> 小程序端 `scorad_records_v1` 建议按年份分 key 存储（如 `scorad_records_2026`），避免单 key 超 1MB 限制。

---

## 六、鉴权与登录

### 6.1 Web 端

- **无强制登录**：打开即用，数据存本机
- **可选微信扫码登录**（方案 B 时启用）：用于跨设备同步，需企业认证主体
- **当前方案 A**：免登录，直接进入首页

### 6.2 微信小程序端

- 使用 `wx.login()` 获取临时 `code`
- **方案 A**：不调用后端，`code` 仅用于本地生成用户标识（或直接用 `wx.getStorageSync` 存一个本地 UUID 作为设备 ID）
- **方案 B**：调用云函数 `wx.cloud.callFunction({ name: 'login' })`，云函数内用 `cloud.getWXContext().OPENID` 获取 openid，返回给前端存本地
- 用户信息（openid）存于 `scorad_user_v1`

### 6.3 数据隔离

- **方案 A**：数据只在本机，天然隔离
- **方案 B**：云数据库记录带 `_openid` 字段，云开发自动按 openid 隔离，用户只能访问自己的数据

---

## 七、多端实现要点

### 7.1 Web 端（Vue 3）目录

```
web/
├── src/
│   ├── engine/             # scorad-engine（或 npm 依赖）
│   ├── storage/
│   │   ├── types.ts        # StorageAdapter 接口
│   │   ├── LocalStorageAdapter.ts
│   │   └── index.ts        # 工厂，返回当前适配器
│   ├── api/                # 无 HTTP 请求（方案 A）
│   ├── components/         # scorad-steps / bsa-input / scorad-slider
│   ├── views/              # home / step1-4 / result / history / guide
│   ├── stores/             # Pinia: recordStore / draftStore（依赖 StorageAdapter）
│   └── main.ts
├── public/
└── vite.config.ts
```

### 7.2 微信小程序端（Taro 4）目录

```
miniapp/
├── src/
│   ├── engine/             # 同 scorad-engine
│   ├── storage/
│   │   ├── types.ts
│   │   ├── WxStorageAdapter.ts    # 封装 wx.setStorageSync
│   │   └── CloudStorageAdapter.ts # 预留（方案 B）
│   ├── pages/              # home / step1-4 / result / history / guide
│   ├── components/
│   └── app.config.ts
├── project.config.json
└── package.json
```

### 7.3 关键交互

- **人体图（小程序）**：Canvas 2D 绘制，点击部位涂色，按 BSA 表自动换算
- **滑块**：原生 `slider` 组件，步长 0.1
- **CSV 导出**：
  - Web：`Blob` + `URL.createObjectURL` 触发下载
  - 小程序：`wx.getFileSystemManager().writeFile` 写入临时文件 → `wx.shareFileMessage` 或 `wx.openDocument`
- **趋势图**：ECharts / ec-canvas，数据来自本地 `listRecords()`

---

## 八、安全与隐私

### 8.1 数据安全

- **全程本地**：患者数据不离开用户设备，无传输、无服务端存储风险
- **CSV 导出**：文件仅保存在用户本地，由用户自行处理
- **科研去标识符**：导出时可配置去除 `patient_name`，仅保留 `subject_screening_no`

### 8.2 小程序发布合规

- **类目选择**：选择「工具」类目（个人号可发布），避免「医疗」类目（需企业资质）
- **文案规范**：首页与指南页明确标注「不用于单独诊断，不能替代专业医疗判断」
- **不涉及**：在线问诊、处方、药品推荐等需要医疗资质的功能

### 8.3 升级方案 B 后的安全补充

- 云数据库权限设置为「仅创建者可读写」，自动按 `_openid` 隔离
- 云函数内校验 `openid`，禁止越权访问他人数据
- 导出操作可在云函数侧记录审计日志

---

## 九、部署与发布（方案 A）

### 9.1 Web 端发布（Cloudflare Pages）

1. 将 `web/` 目录构建产物（`dist/`）推送到 GitHub 仓库
2. Cloudflare Pages 连接仓库，构建命令 `npm run build`，输出目录 `dist`
3. 自动获得 `https://<project>.pages.dev` 域名，含 HTTPS + 全球 CDN
4. 可选：绑定自定义域名（需自有域名，约 60 元/年）

> **GitHub Pages 备选**：同样免费，推送到 `gh-pages` 分支即可，获得 `https://<user>.github.io/<repo>/`。

### 9.2 微信小程序发布

1. 注册个人微信小程序账号（免费）
2. 下载微信开发者工具，导入 `miniapp/` 项目
3. 填入 AppID，上传代码
4. 在微信公众平台提交审核（工具类目，通常 1–3 天）
5. 审核通过后发布，用户扫码即用

### 9.3 发布流程

```
代码提交 → 本地构建验证 → 
  ├─ Web: 推送 GitHub → Cloudflare Pages 自动部署
  └─ 小程序: 开发者工具上传 → 公众平台审核 → 发布
```

---

## 十、启用方案 B 的步骤（代码已就绪，仅剩用户操作）

> **小程序端 1～3 步已于 2026-10-20 全部完成**。当前唯一注意事项：所用环境为**免费体验版**（40,000 资源点/月，自开通日起 6 个月体验期，约 2027-04-20 到期）。到期后二选一：升级基础套餐（¥19.9/月），或 `USE_CLOUD` 置回 `false` 退回纯本地（数据在本机与云端各存一份，不受影响）。

代码侧已全部实现（见 4.4），业务代码零修改。剩余启用步骤均为用户操作：

1. ~~**开通微信云开发**：小程序后台开通，获得环境 ID；创建集合 `assessment_records`（权限：**仅创建者可读写**）~~ ✅ 2026-10-20 完成（环境 `cloud1-d1gvx0dpzae6aede6`，免费体验版）
2. ~~**部署 login 云函数**：微信开发者工具中右键 `miniapp/cloud/functions/login` →「上传并部署：云端安装依赖」~~ ✅ 2026-10-20 完成（需先在 `functions` 根目录右键「当前环境」绑定环境）
3. ~~**小程序端启用**：`miniapp/src/config/cloud.ts` 填入 `ENV_ID`；`miniapp/src/storage/index.ts` 置 `USE_CLOUD = true`~~ ✅ 2026-10-20 完成
4. **Web 端启用（可选，独立云环境，未启用）**：
   - 腾讯云 CloudBase 控制台开通环境、开启**匿名登录**、添加部署域名为安全域名
   - `web/.env.production` 填入 `VITE_CLOUDBASE_ENV`；`web/src/storage/index.ts` 置 `USE_CLOUD = true`
   - 集合 `assessment_records` 安全规则按 `auth.uid` 隔离（详见 .env.production 注释）
5. **成本**：免费体验期内 **0 元**（40,000 资源点/月，6 个月；到期后基础套餐 ¥19.9/月，见本章顶部注意事项）

---

## 十一、成本汇总

### 11.1 方案 A（当前）

| 项 | 年度成本 |
|----|---------|
| Web 托管（Cloudflare Pages） | 0 元 |
| 小程序账号与发布 | 0 元 |
| 域名（可选，用平台自带域名） | 0 元 |
| SSL | 0 元 |
| 后端 / 数据库 / 运维 | 0 元 |
| **合计** | **0 元/年** |

### 11.2 方案 B（升级后）

| 项 | 年度成本 |
|----|---------|
| 微信云开发（免费额度内） | 0 元 |
| 其他同方案 A | 0 元 |
| **合计** | **0 元/年**（免费额度内） |

### 11.3 一次性成本

| 项 | 成本 |
|----|------|
| 小程序个人号认证 | 0 元（个人号免费） |
| 域名（可选） | 0–60 元/年 |
| 开发人力 | 自有/公益，无外包成本 |

---

## 十二、实施路线图

### 阶段一：Web 端可用（2 周）

- [ ] 抽取 `scorad-engine` 为独立模块（从原型 `engine.js` 迁移到 TS）
- [ ] 实现 `StorageAdapter` 接口 + `LocalStorageAdapter`
- [ ] Vue 3 重写四步评估 + 历史 + CSV 导出（迁移现有原型逻辑）
- [ ] 科研模式开关 + 科研字段
- [ ] Cloudflare Pages 部署上线

### 阶段二：微信小程序端（2 周）

- [ ] Taro 4 初始化小程序项目
- [ ] 复用 `scorad-engine` + `StorageAdapter`（WxStorageAdapter）
- [ ] 小程序页面开发（home / step1-4 / result / history / guide）
- [ ] `wx.login` 本地用户标识
- [ ] 上传审核发布

### 阶段三：可选升级（按需）

- [ ] 实现 `CloudStorageAdapter`，开通云开发
- [ ] 多设备同步验证
- [ ] 受试者趋势图（ECharts / ec-canvas）

---

## 十三、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 小程序「工具」类目审核不通过 | 无法发布 | 文案避免医疗术语，强调「评分记录工具」而非诊断；必要时改为「效率」类目 |
| localStorage 被用户清理 | 数据丢失 | 引导用户定期导出 CSV 备份；方案 B 提供云同步 |
| 小程序 10MB 存储上限 | 记录过多 | 按年份分 key 存储；超过阈值提示导出清理 |
| Web 与小程序数据不互通 | 跨端不便 | 方案 B 云同步解决；方案 A 下可通过 CSV 导入导出手动迁移 |
| 评分引擎端侧计算被篡改 | 数据可信度低 | 本工具为辅助记录，不涉及诊疗决策；方案 B 可加服务端复算校验 |

---

## 十四、参考文档

- [SCORAD 评分说明](https://www.notion.so/eczema-international)（Eczema Foundation）
- [微信小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
- [微信云开发免费额度](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/price.html)
- [Cloudflare Pages](https://pages.cloudflare.com/)
- [Taro 文档](https://docs.taro.zone/)
- [Vue 3 文档](https://vuejs.org/)
