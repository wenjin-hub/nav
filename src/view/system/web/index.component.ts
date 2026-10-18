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

  // 当前选中的树节点（根 = null）
  get selectedNode(): any | null {
    if (this.selThreeId !== -1) return this.threeNode
    if (this.selTwoId !== -1) return this.twoNode
    if (this.selOneId !== -1) return this.oneNode
    return null
  }

  // ===== 纯包裹层折叠 =====
  // 纯包裹层：分类下没有直接网址、且只有 1 个子分类（如「网盘搜索>网盘搜索」）
  isWrapper(node: any): boolean {
    return (
      !!node &&
      !node.url &&
      Array.isArray(node.nav) &&
      node.nav.length === 1 &&
      !node.nav[0].url
    )
  }

  // 穿透纯包裹层，拿到实际存放内容的节点
  resolveLeaf(node: any): any {
    let cur = node
    let guard = 0
    while (this.isWrapper(cur) && guard++ < 10) {
      cur = cur.nav[0]
    }
    return cur
  }

  // 树中是否显示展开箭头（有下一级分类，且自身不是纯包裹层）
  hasCatChildren(node: any): boolean {
    return (
      !!node &&
      !this.isWrapper(node) &&
      Array.isArray(node.nav) &&
      node.nav.some((c: any) => !c.url)
    )
  }

  // 树行显示的数量（纯包裹层显示穿透后的网址数）
  nodeCount(node: any): number {
    return this.resolveLeaf(node)?.nav?.length || 0
  }

  // 右侧当前列表：实际内容容器的直接子级
  get rightList(): any[] {
    const sel = this.selectedNode
    if (!sel) return this.navs()
    return this.resolveLeaf(sel)?.nav || []
  }

  get rightKind(): RowKind {
    const sel = this.selectedNode
    if (!sel) return 'one'
    // 穿透了包裹层 → 实际展示网址
    if (this.resolveLeaf(sel) !== sel) return 'web'
    if (this.selThreeId !== -1) return 'web'
    if (this.selTwoId !== -1) return 'three'
    return 'two'
  }

  get rightTitle(): string {
    return this.selectedNode?.title || '根目录（一级分类）'
  }

  // 当前选中目录对应的「实际内容容器」（用于接收拖拽放入 / 新增网址）
  get currentContainerNav(): any[] | null {
    const sel = this.selectedNode
    if (!sel) return null
    return this.resolveLeaf(sel)?.nav || null
  }

  get currentLeafId(): number {
    const sel = this.selectedNode
    return sel ? this.resolveLeaf(sel)?.id ?? -1 : -1
  }

  // ===== 选择（点击任意层级直达，自动展开父级） =====
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
    if (this.hasCatChildren(this.oneNode) && !this.expanded.has(id)) {
      this.expanded.add(id)
    }
  }

  selectTwo(id: number) {
    // 自动定位父级，保证「直接点二级」也能正确显示
    for (const one of this.navs()) {
      if ((one.nav || []).some((n: any) => n.id === id)) {
        this.selOneId = one.id
        if (!this.expanded.has(one.id)) this.expanded.add(one.id)
        break
      }
    }
    this.selTwoId = id
    this.selThreeId = -1
    this.checked.clear()
    if (this.hasCatChildren(this.twoNode) && !this.expanded.has(id)) {
      this.expanded.add(id)
    }
  }

  selectThree(id: number) {
    // 自动定位父级链，保证「直接点三级」也能正确显示
    for (const one of this.navs()) {
      for (const two of one.nav || []) {
        if ((two.nav || []).some((n: any) => n.id === id)) {
          this.selOneId = one.id
          this.selTwoId = two.id
          if (!this.expanded.has(one.id)) this.expanded.add(one.id)
          if (!this.expanded.has(two.id)) this.expanded.add(two.id)
          this.selThreeId = id
          this.checked.clear()
          return
        }
      }
    }
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

  // 任意层级的分类节点都接受网址/分类拖入（防止移入自身子树由 moveInto 里的 hasRef 处理）
  onDragOverNode(node: any, e: DragEvent) {
    if (!this.dragKind || this.dragKind === 'one') return
    e.preventDefault()
    this.dropTargetId = node.id
  }

  onDropNode(node: any, e: DragEvent) {
    e.preventDefault()
    if (!this.dragIds.length) return
    // 放入该节点穿透包裹层后的实际内容容器
    const leaf = this.resolveLeaf(node)
    if (!leaf?.nav) return
    this.moveInto(leaf.nav)
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
      event.emit('CREATE_WEB', { parentId: this.currentLeafId })
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
