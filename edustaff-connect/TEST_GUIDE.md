# 学生上传功能测试指南

## 功能概述

已实现完整的学生上传功能，支持：
- **手动添加**：单个学生信息录入
- **批量CSV上传**：支持CSV文件批量导入
- **数据预览**：导入前可预览数据
- **完善的验证**：必填项、文件格式、大小限制等
- **服务器端API**：Express + MongoDB

## 启动项目

### 1. 确保MongoDB运行

确保本地 MongoDB 服务正在运行（默认端口 27017），或设置环境变量 `MONGODB_URI`。

### 2. 启动后端和前端

```bash
# 在项目根目录
npm install
npm run dev
```

或者分别启动：

```bash
# 启动后端（端口 5000）
npm run server

# 在另一个终端启动前端（端口 5173-5177）
npm run client
```

## 功能测试

### A. 手动添加学生

1. 登录后点击导航栏的 "Upload" 或 "Add Student" 按钮
2. 选择 "Manual Entry" 标签
3. 填写必填字段（学生姓名、年级、监护人姓名、电话）
4. 点击 "Add Student"
5. 验证：
   - 成功消息显示
   - 联系人列表更新

### B. CSV批量上传

#### 1. 准备CSV文件

创建名为 `students.csv` 的文件，格式如下：

```csv
studentName,grade,guardianName,guardianPhone,guardianEmail,status,notes
"John Doe","Grade 5","Jane Doe","+1 555-123-4567","jane@example.com","Primary Guardian","Allergies to peanuts"
"Alice Smith","Grade 3","Bob Smith","+1 555-987-6543","","New Admission",""
"Charlie Brown","Grade 1","Sally Brown","+1 555-111-2222","sally@school.edu","Absent Today","Fever"
```

**必填列**：
- `studentName`
- `grade`
- `guardianName`
- `guardianPhone`

**可选列**：
- `guardianEmail`
- `status`
- `notes`

#### 2. 上传并测试

1. 点击 "CSV Upload" 标签
2. 选择准备好的CSV文件
3. 点击 "Preview CSV" 查看数据
4. 检查预览数据是否正确
5. 点击 "Import Students" 导入
6. 验证成功消息和导入数量

### C. 边界情况测试

#### 1. 文件格式验证

- 尝试上传非CSV文件（如 .jpg, .pdf）
- 预期：错误提示 "Only CSV files are allowed"

#### 2. 文件大小限制

- 创建一个大于 10MB 的文件
- 预期：上传被拒绝

#### 3. 缺少必填列

- 从CSV中删除 `studentName` 列
- 预期：显示错误消息，提示缺少必填列

#### 4. 空必填字段

- 在CSV中某些行缺少 `guardianPhone`
- 预期：预览时显示错误，这些行不会导入

#### 5. 无效数据

- 上传损坏的或格式错误的CSV
- 预期：显示解析错误

### D. API测试（可选）

使用 curl 或 Postman 测试API：

#### 手动添加
```bash
curl -X POST http://localhost:5000/api/uploads/manual \
  -H "Content-Type: application/json" \
  -d '{
    "studentName": "Test Student",
    "grade": "Grade 6",
    "guardianName": "Test Guardian",
    "guardianPhone": "+1 555-123-4567",
    "status": "Primary Guardian"
  }'
```

#### CSV预览
```bash
curl -X POST http://localhost:5000/api/uploads/csv/preview \
  -F "file=@students.csv"
```

#### CSV导入
```bash
curl -X POST http://localhost:5000/api/uploads/csv/import \
  -F "file=@students.csv"
```

## 项目结构总结

### 后端
- `server/index.js` - Express应用入口
- `server/models/` - MongoDB模型（User, Contact, Activity）
- `server/routes/uploads.js` - 上传API路由
- `server/routes/contacts.js` - 联系人API

### 前端
- `src/App.jsx` - 主应用组件
- `src/components/uploads/StudentUpload.jsx` - 上传组件
- `src/components/layout/` - 导航组件
- `src/services/data.js` - 共享数据

## 已实现功能

✅ 手动添加学生表单
✅ 客户端验证（必填项）
✅ CSV文件上传
✅ 文件类型验证（仅CSV）
✅ 文件大小限制（10MB）
✅ 数据预览功能
✅ 服务器端验证
✅ 导入成功/错误提示
✅ 用户界面友好
✅ 与现有系统集成
✅ 深色/浅色主题支持

## 注意事项

1. 确保 MongoDB 服务运行正常
2. 首次使用时，会自动创建 `edustaff-connect` 数据库
3. 数据导入后会自动刷新联系人列表
