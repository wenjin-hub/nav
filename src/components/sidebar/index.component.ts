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
  // 整页滚动模式：点击菜单不切换路由过滤，而是通知视图平滑滚动到对应区域
  @Input() scrollMode: boolean = false

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
}
