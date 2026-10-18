// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xie.jiahe. All rights reserved.
// See https://github.com/liuzi6612/nav
// Edge 收藏夹风格重构：左侧目录树 + 右侧下一级内容，支持批量拖拽移动/删除、拖拽排序

import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import type { IWebProps } from 'src/types'
import { navs, settings, search, tagList, internal, component } from 'src/store'
import { isLogin, removeWebsite } from 'src/utils/user'
import { NzMessageService } from 'ng-zorro-antd/message'
import { NzModalService } from 'ng-zorro-antd/modal'
import { NzNotificationService } from 'ng-zorro-antd/notification'
import { setNavs } from 'src/utils/web'
import { updateFileContent } from 'src/api'
import {
  DB_PATH,
  TAG_PATH,
  SETTING_PATH,
  SEARCH_PATH,
  COMPONENT_PATH,
  STORAGE_KEY_MAP,
} from 'src/constants'
import { $t } from 'src/locale'
import { saveAs } from 'file-saver'
import { isSelfDevelop } from 'src/utils/utils'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm'
import { NzIconModule } from 'ng-zorro-antd/icon'
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox'
import { NzModalModule } from 'ng-zorro-antd/modal'
import { LogoComponent } from 'src/components/logo/logo.component'
import event from 'src/utils/mitt'
import config from '../../../../nav.config.json'
import { cleanWebAttrs } from 'src/utils/pureUtils'

type RowKind = 'one' | 'two' | 'three' | 'web'

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzPopconfirmModule,
    NzIconModule,
    NzCheckboxModule,
    NzModalModule,
    LogoComponent,
  ],
  selector: 'app-web',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class WebpComponent {
  readonly $t = $t
  readonly isSelfDevelop = isSelfDevelop
  readonly internal = internal()
  readonly settings = settings()
  readonly gitRepoUrl = config.gitRepoUrl
  readonly isLogin = isLogin
  navs = navs
  syncLoading = false

  // ===== 树状态 =====
  expanded = new Set<number>()
  selOneId = -1
  selTwoId = -1
  selThreeId = -1

  // ===== 勾选 / 拖拽 =====
  checked = new Set<number>()
  dragIds: number[] = []
  dragKind: RowKind | '' = ''
  dropTargetId = -1

  constructor(
    private modal: NzModalService,
    private notification: NzNotificationService,
    private message: NzMessageService,
  ) {}

  // ===== 节点获取 =====
  get oneNode() {
    return this.navs().find((n) => n.id === this.selOneId)
  }
  get twoNode() {
    return this.oneNode?.nav?.find((n) => n.id === this.selTwoId)
  }
  get threeNode() {
    return this.twoNode?.nav?.find((n) => n.id === this.selThreeId)
  }

  // 右侧当前列表 + 类型
  get rightList(): any[] {
    if (this.selThreeId !== -1) return this.threeNode?.nav || []
    if (this.selTwoId !== -1) return this.twoNode?.nav || []
    if (this.selOneId !== -1) return this.oneNode?.nav || []
    return this.navs()
  }
  get rightKind(): RowKind {
    if (this.selThreeId !== -1) return 'web'
    if (this.selTwoId !== -1) return 'three'
    if (this.selOneId !== -1) return 'two'
    return 'one'
  }
  get rightTitle(): string {
    if (this.selThreeId !== -1) return this.threeNode?.title || ''
    if (this.selTwoId !== -1) return this.twoNode?.title || ''
    if (this.selOneId !== -1) return this.oneNode?.title || ''
    return '根目录（一级分类）'
  }

  // 当前选中目录对应的「容器 nav」（用于接收拖拽放入）
  get currentContainerNav(): any[] | null {
    if (this.selThreeId !== -1) return this.threeNode?.nav || null
    if (this.selTwoId !== -1) return this.twoNode?.nav || null
    if (this.selOneId !== -1) return this.oneNode?.nav || null
    return null
  }

  // ===== 选择 =====
  toggleExpand(id: number, e: Event) {
    e.stopPropagation()
    if (this.expanded.has(id)) this.expanded.delete(id)
    else this.expanded.add(id)
  }

  selectOne(id: number) {
    this.selOneId = id
    this.selTwoId = -1
    this.selThreeId = -1
    this.checked.clear()
    if (!this.expanded.has(id)) this.expanded.add(id)
  }
  selectTwo(id: number) {
    this.selTwoId = id
    this.selThreeId = -1
    this.checked.clear()
    if (!this.expanded.has(id)) this.expanded.add(id)
  }
  selectThree(id: number) {
    this.selThreeId = id
    this.checked.clear()
  }

  get allChecked(): boolean {
    return this.rightList.length > 0 && this.checked.size === this.rightList.length
  }
  toggleAll(e: any) {
    this.checked.clear()
    if (e.target.checked) {
      this.rightList.forEach((item) => this.checked.add(item.id))
    }
  }
  toggleCheck(id: number, e: any) {
    if (e.target.checked) this.checked.add(id)
    else this.checked.delete(id)
  }

  // ===== 拖拽 =====
  onDragStartRow(item: any, e: DragEvent) {
    const kind = this.rightKind
    if (kind === 'one') {
      this.dragIds = [item.id]
      this.dragKind = 'one'
    } else if (this.checked.has(item.id) && this.checked.size > 1) {
      this.dragIds = [...this.checked]
      this.dragKind = kind
    } else {
      this.dragIds = [item.id]
      this.dragKind = kind
    }
    e.dataTransfer?.setData('text/plain', String(item.id))
  }

  onDragEnd() {
    this.dragIds = []
    this.dragKind = ''
    this.dropTargetId = -1
  }

  // 树节点接受哪种拖拽：一级收二级、二级收三级、三级收网址
  nodeAccepts(level: 0 | 1 | 2): boolean {
    if (this.dragKind === 'two') return level === 0
    if (this.dragKind === 'three') return level === 1
    if (this.dragKind === 'web') return level === 2
    return false
  }

  onDragOverNode(node: any, level: 0 | 1 | 2, e: DragEvent) {
    if (!this.dragKind || !this.nodeAccepts(level)) return
    e.preventDefault()
    this.dropTargetId = node.id
  }

  onDropNode(node: any, e: DragEvent) {
    e.preventDefault()
    if (!this.dragIds.length) return
    this.moveInto(node.nav || [])
  }

  // 拖到右侧面板头部 = 放入当前目录
  onDragOverPanel(e: DragEvent) {
    if (!this.dragKind || this.dragKind === 'one') return
    e.preventDefault()
    this.dropTargetId = -2 // -2 表示面板放置区
  }

  onDropPanel(e: DragEvent) {
    e.preventDefault()
    if (!this.dragIds.length) return
    const target = this.currentContainerNav
    if (!target) return
    this.moveInto(target)
  }

  // 拖到某一行上 = 排序到该行之前
  onDragOverRow(item: any, e: DragEvent) {
    if (!this.dragKind) return
    e.preventDefault()
    e.stopPropagation()
    this.dropTargetId = item.id
  }

  onDropRow(item: any, e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!this.dragIds.length) return
    if (this.dragKind === 'one' || this.dropTargetId === item.id) {
      this.moveBefore(item.id)
    } else {
      // 跨层级拖到行上时，尝试放入该行所在容器
      const loc = this.locate(item.id)
      if (loc) this.moveInto(loc.list)
    }
  }

  // ===== 移动实现 =====
  locate(
    id: number,
    list: any[] = this.navs(),
  ): { list: any[]; index: number } | null {
    for (let i = 0; i < list.length; i++) {
      if (list[i]?.id === id) return { list, index: i }
      if (Array.isArray(list[i]?.nav)) {
        const r = this.locate(id, list[i].nav)
        if (r) return r
      }
    }
    return null
  }

  // 被拖文件夹的子树里是否包含目标容器（防止把父目录移进自己）
  hasRef(node: any, ref: any[]): boolean {
    if (!Array.isArray(node?.nav)) return false
    if (node.nav === ref) return true
    return node.nav.some((c: any) => !c.url && this.hasRef(c, ref))
  }

  moveInto(targetNav: any[]) {
    let moved = 0
    for (const id of this.dragIds) {
      const loc = this.locate(id)
      if (!loc) continue
      if (loc.list === targetNav) continue
      const item = loc.list[loc.index]
      if (!item.url && this.hasRef(item, targetNav)) continue
      loc.list.splice(loc.index, 1)
      targetNav.push(item)
      moved++
    }
    if (moved) {
      setNavs(this.navs())
      this.message.success(`已移动 ${moved} 项到「${this.dropTargetName(targetNav)}」，记得点「保 存」同步`)
    }
    this.onDragEnd()
    this.checked.clear()
  }

  dropTargetName(targetNav: any[]): string {
    const findTitle = (list: any[]): string => {
      for (const n of list) {
        if (n.nav === targetNav) return n.title
        if (Array.isArray(n.nav)) {
          const t = findTitle(n.nav)
          if (t) return t
        }
      }
      return ''
    }
    return findTitle(this.navs()) || '目标目录'
  }

  moveBefore(targetId: number) {
    const tLoc = this.locate(targetId)
    if (!tLoc) return
    const list = tLoc.list
    let tIndex = tLoc.index
    const items: any[] = []
    for (const id of this.dragIds) {
      const idx = list.findIndex((x) => x.id === id)
      if (idx === -1) continue
      items.push(list[idx])
      list.splice(idx, 1)
      if (idx < tIndex) tIndex--
    }
    if (items.length) {
      list.splice(tIndex, 0, ...items)
      setNavs(this.navs())
      this.message.success('排序已更新，记得点「保 存」同步')
    }
    this.onDragEnd()
  }

  // ===== 新增 / 编辑 / 删除 =====
  openCreate() {
    if (this.rightKind === 'web') {
      event.emit('CREATE_WEB', { parentId: this.selThreeId })
      return
    }
    if (this.rightKind === 'three') {
      event.emit('EDIT_CLASS_OPEN', { id: this.selTwoId })
      return
    }
    if (this.rightKind === 'two') {
      event.emit('EDIT_CLASS_OPEN', { id: this.selOneId })
      return
    }
    event.emit('EDIT_CLASS_OPEN', {})
  }

  openEdit(item: any) {
    if (item.url) {
      event.emit('CREATE_WEB', { detail: item })
    } else {
      event.emit('EDIT_CLASS_OPEN', {
        title: item.title,
        icon: item.icon,
        id: item.id,
        ownVisible: item.ownVisible,
      })
    }
  }

  delItems(ids: number[], isClass: boolean) {
    event.emit('DELETE_MODAL', {
      ids,
      isClass,
      onComplete: () => this.cleanSelection(),
    })
  }

  onBatchDelete() {
    if (!this.checked.size) return
    this.delItems([...this.checked], this.rightKind !== 'web')
  }

  // 删除后清理失效的选中状态
  cleanSelection() {
    if (this.selOneId !== -1 && !this.locate(this.selOneId)) this.selectTop()
    else if (this.selTwoId !== -1 && !this.locate(this.selTwoId)) this.selectOne(this.selOneId)
    else if (this.selThreeId !== -1 && !this.locate(this.selThreeId)) this.selectTwo(this.selTwoId)
    this.checked.clear()
  }

  selectTop() {
    this.selOneId = -1
    this.selTwoId = -1
    this.selThreeId = -1
    this.checked.clear()
  }

  // ===== 以下为原有能力：同步 / 备份 / 恢复 =====
  handleRestoreData() {
    this.modal.info({
      nzTitle: $t('_resetInitData'),
      nzContent: $t('_warnReset'),
      nzOnOk: () => {
        this.message.success($t('_actionSuccess'))
        window.localStorage.removeItem(STORAGE_KEY_MAP.DATE_TIME)
        removeWebsite().finally(() => {
          window.location.reload()
        })
      },
    })
  }

  handleDownloadBackup() {
    const params: any = {
      db: this.navs(),
      settings: settings(),
      tag: tagList(),
      search: search(),
      component: component(),
    }
    saveAs(
      new Blob([JSON.stringify(params)], {
        type: 'text/plain;charset=utf-8',
      }),
      'nav.json',
    )
  }

  handleUploadBackup(e: any) {
    const that = this
    const files = e.target.files
    if (files.length <= 0) {
      return
    }
    const file = files[0]
    const fileReader = new FileReader()
    fileReader.readAsText(file)
    fileReader.onload = async function (ev: any) {
      try {
        const { result } = ev.target as any
        const data = JSON.parse(result)
        await updateFileContent({
          message: 'import db',
          content: JSON.stringify(data.db),
          path: DB_PATH,
          refresh: false,
        })
        that.notification.success('OK', 'DB import successful')
        if (data.settings) {
          await updateFileContent({
            message: 'import settings',
            content: JSON.stringify({ ...settings(), ...data.settings }),
            path: SETTING_PATH,
            refresh: false,
          })
          that.notification.success('OK', 'settings import successful')
        }
        that.message.success($t('_syncSuccessTip'))
      } catch (error: any) {
        that.notification.error($t('_error'), error.message)
      } finally {
        e.target.value = ''
      }
    }
  }

  async handleSync() {
    this.modal.info({
      nzTitle: $t('_syncDataOut'),
      nzOkText: $t('_confirmSync'),
      nzContent: $t('_confirmSyncTip'),
      nzOnOk: () => {
        this.syncLoading = true
        updateFileContent({
          message: 'update db',
          content: JSON.stringify(cleanWebAttrs(this.navs())),
          path: DB_PATH,
        })
          .then(() => {
            this.message.success($t('_syncSuccessTip'))
          })
          .finally(() => {
            this.syncLoading = false
          })
      },
    })
  }
}
