// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/liuzi6612/nav

import { Component, Input } from '@angular/core'
import type { INavProps, INavTwoProp } from 'src/types'
import { CommonModule } from '@angular/common'
import { NzMenuModule } from 'ng-zorro-antd/menu'
import { CommonService } from 'src/services/common'
import { navs } from 'src/store'
import { settings } from 'src/store'
import { STORAGE_KEY_MAP } from 'src/constants'
import { isMobile, isDark } from 'src/utils'
import { NzIconModule } from 'ng-zorro-antd/icon'
import { LogoComponent } from 'src/components/logo/logo.component'
import { NzLayoutModule } from 'ng-zorro-antd/layout'
import event from 'src/utils/mitt'

function getDefaultCollapsed(): boolean {
  if (isMobile()) {
    return false
  }
  const localCollapsed = localStorage.getItem(STORAGE_KEY_MAP.SIDE_COLLAPSED)
  if (localCollapsed) {
    return localCollapsed === 'true'
  }
  return settings().sideCollapsed
}

@Component({
  standalone: true,
  imports: [
    CommonModule,
    NzIconModule,
    LogoComponent,
    NzMenuModule,
    NzLayoutModule,
  ],
  selector: 'app-sidebar',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
  providers: [],
})
export class SidebarComponent {
  @Input() showTop: boolean = true
  // 整页滚动模式：使用自定义菜单（悬停浮层+点击直接滚动），与其他主题完全隔离
  @Input() scrollMode: boolean = false
  // 整页滚动模式：每个一级分类当前选中的二级分类 id
  @Input() selectedTwoMap: Record<number, number> = {}

  // 悬停浮层状态
  hoverOneId = 0
  flyoutTop = 0
  flyoutLeft = 0

  navs: INavProps[] = navs()
  isDark = isDark()
  isCollapsed = getDefaultCollapsed()
  openSidebar = false
  menuOpenId = 0

  constructor(public commonService: CommonService) {
    this.menuOpenId = this.navs[commonService.oneIndex]?.id || 0

    event.on('EVENT_DARK', (isDark: unknown) => {
      this.isDark = isDark as boolean
    })

    // 整页滚动模式下，右侧滚动到某分类时，自动展开左侧对应的一级菜单
    event.on('SIDE_SPY_ONE', (oneId: unknown) => {
      if (!this.scrollMode) return
      const id = oneId as number
      if (id && this.navs.some((n) => n.id === id)) {
        this.menuOpenId = id
      }
    })
  }

  get logoImage() {
    return this.isDark
      ? this.commonService.settings().darkLogo ||
          this.commonService.settings().logo
      : this.commonService.settings().logo ||
          this.commonService.settings().darkLogo
  }

  openMenu(item: INavProps) {
    this.menuOpenId = item.id
  }

  toggleSidebar(openSidebar?: boolean) {
    this.openSidebar = openSidebar ?? !this.openSidebar
    if (this.openSidebar) {
      document.body.classList.add('overflow-hidden')
    } else {
      document.body.classList.remove('overflow-hidden')
    }
  }

  handleCollapsed() {
    this.isCollapsed = !this.isCollapsed
    localStorage.setItem(
      STORAGE_KEY_MAP.SIDE_COLLAPSED,
      String(this.isCollapsed),
    )
    setTimeout(() => {
      event.emit('COMPONENT_CHECK_OVER')
    }, 300)
  }

  onClickNav(item: INavTwoProp) {
    if (this.scrollMode) {
      // 整页滚动模式：通知视图滚动到对应区域，不改变路由
      const parent = this.navs.find((n) =>
        (n.nav || []).some((two) => two.id === item.id),
      )
      event.emit('SIDE_SCROLL_TO', {
        oneId: parent?.id || 0,
        twoId: item.id,
      })
      this.toggleSidebar(false)
      return
    }
    this.commonService.handleClickClass(item.id)
    this.toggleSidebar(false)
  }

  // ===== 整页滚动模式专用：悬停浮层菜单 =====

  // 鼠标移入一级目录：记录位置，在其右侧弹出二级浮层
  onHoverOne(one: INavProps, evt: MouseEvent) {
    this.hoverOneId = one.id
    const rect = (evt.currentTarget as HTMLElement).getBoundingClientRect()
    // 预估浮层高度，避免底部超出视口
    const flyoutHeight = (one.nav?.length || 0) * 42 + 20
    this.flyoutTop = Math.max(
      8,
      Math.min(rect.top, window.innerHeight - flyoutHeight - 8),
    )
    this.flyoutLeft = rect.right
  }

  onLeaveOne() {
    this.hoverOneId = 0
  }

  // 某二级是否为该区域当前选中的（未手动选择过则默认第一个）
  isTwoActive(one: INavProps, two: INavTwoProp): boolean {
    const selectedId = this.selectedTwoMap?.[one.id]
    const activeId = selectedId || one.nav?.[0]?.id
    return activeId === two.id
  }

  // 点击一级目录：右侧滚动到该分类区域
  onClickOne(one: INavProps) {
    this.hoverOneId = 0
    if (!this.scrollMode) return
    event.emit('SIDE_SCROLL_TO', { oneId: one.id, twoId: 0 })
    this.toggleSidebar(false)
  }

  // 点击浮层里的二级目录：右侧切换到该二级并滚动
  onClickTwo(one: INavProps, two: INavTwoProp) {
    this.hoverOneId = 0
    if (!this.scrollMode) return
    event.emit('SIDE_SCROLL_TO', { oneId: one.id, twoId: two.id })
    this.toggleSidebar(false)
  }
}
