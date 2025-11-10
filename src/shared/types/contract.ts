// 数据标记类型
export type MarkType = 'single' | 'list' | 'parameter'
export type MarkResolutionType = 'binding' | 'skip'

// 单个值绑定
export interface SingleValueBinding {
  type: 'single'
  mark: string // 例如: "d.company_name"
  dataSource: string // 数据源 ID
  sheetName: string // 工作表名称
  cellCoordinate: string // 单元格坐标,例如: "E5"
  dataType?: 'auto' | 'text' | 'number' | 'date'
}

// 字段映射(用于列表)
export interface FieldMapping {
  fieldName: string // 模板字段名,例如: "item.name"
  headerText: string // 数据源表头文本,例如: "姓名"
}

// 列表绑定
export interface ListBinding {
  type: 'list'
  mark: string // 例如: "d.users[]"
  dataSource: string // 数据源 ID
  sheetName: string
  rangeMethod: 'header' | 'fixed' | 'column' // 数据范围方法
  headerRow?: number // 表头行号(rangeMethod='header'时)
  dataStartRow?: number // 数据起始行号(rangeMethod='header'时)
  fieldMappings?: FieldMapping[] // 字段映射
  fixedRange?: string // 固定范围,例如: "A2:C50" (rangeMethod='fixed'时)
  columns?: string[] // 整列,例如: ["A", "C"] (rangeMethod='column'时)
}

// 运行时参数定义
export interface ParameterDefinition {
  type: 'parameter'
  mark: string // 例如: "v.report_month"
  displayLabel: string // 显示标签,例如: "请输入统计月份："
  dataType: 'text' | 'number' | 'date'
  defaultValue?: string
}

// 数据源
export interface DataSource {
  id: string
  name: string // 例如: "Source 1", "销售数据"
}

// 数据绑定联合类型
export type DataBinding = SingleValueBinding | ListBinding | ParameterDefinition

// 标记项(用于左侧清单显示)
export interface MarkItem {
  mark: string // 原始标记,例如: "d.company_name"
  markType: MarkType
  configured: boolean // 是否已配置
  displayText: string // 显示文本(已配置时显示配置摘要)
}

// 报表契约
export interface ReportContract {
  id: string
  name: string
  description?: string
  templatePath: string
  templateFileName: string
  templateChecksum: string
  dataSources: DataSource[]
  bindings: DataBinding[]
  createdAt: string
  updatedAt: string
}

// 渲染流程中待保存的契约草稿
export interface ContractDraftPayload {
  templatePath: string
  templateFileName: string
  templateChecksum: string
  dataSources: DataSource[]
  bindings: DataBinding[]
}

// 创建契约时发送给主进程的载荷
export interface CreateContractPayload extends ContractDraftPayload {
  id?: string
  name: string
  description?: string
}

export interface UpdateContractPayload extends ContractDraftPayload {
  id: string
  name: string
  description?: string
}

// 运行时参数值
export interface RuntimeParameterValue {
  mark: string
  value: string | number
}

// 运行时数据源文件
export interface RuntimeDataSourceFile {
  dataSourceId: string
  dataSourceName: string
  uploaded: boolean
  fileName?: string
  checksum?: string
}
