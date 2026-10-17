// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/liuzi6612/nav

import { Component, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { $t } from 'src/locale'
import { CommonService } from 'src/services/common'
import { ComponentGroupComponent } from 'src/components/component-group/index.component'
import { SearchComponent } from 'src/components/search/index.component'
import { NzSpinModule } from 'ng-zorro-antd/spin'
import { CardComponent } from 'src/components/card/index.component'
import { NoDataComponent } from 'src/components/no-data/no-data.component'
import { FooterComponent } from 'src/components/footer/footer.component'
import { FixbarComponent } from 'src/components/fixbar/index.component'
import { SwiperComponent } from 'src/components/swiper/index.component'
import { ToolbarTitleWebComponent } from 'src/components/toolbar-title/index.component'
import { WebListComponent } from 'src/components/web-list/index.component'
import { ClassTabsComponent } from 'src/components/class-tabs/index.component'
import { SidebarComponent } from 'src/components/sidebar/index.component'
import { filterLoginData } from 'src/utils/pureUtils'
import { isLogin } from 'src/utils/user'
import type { INavProps, INavThreeProp } from 'src/types'
import event from 'src/utils/mitt'
import { Subscription, fromEvent } from 'rxjs'
import { debounceTime } from 'rxjs/operators'

@Component({
  standalone: true,
  imports: [
    CommonModule,
    WebListComponent,
    ToolbarTitleWebComponent,
    ComponentGroupComponent,
    SearchComponent,
    NzSpinModule,
    CardComponent,
    NoDataComponent,
    FooterComponent,
    FixbarComponent,
    SwiperComponent,
    ClassTabsComponent,
    SidebarComponent,
  ],
  selector: 'app-side',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class SideComponent implements OnDestroy {
  readonly $t = $t

  // 整页数据：所有一级分类（已过滤「仅自己可见」，访客不可见私密分类）
  pageList: INavProps[] = []

  private disableScrollEvent = false
  private scrollTimer: any = null
  private scrollSub: Subscription | null = null

  constructor(public commonService: CommonService) {
    this.buildPage()
    event.on('WEB_FINISH', () => this.buildPage())
    event.on('WEB_REFRESH', () => this.buildPage())
    // 左侧菜单点击 → 平滑滚动到对应区域
    event.on('SIDE_SCROLL_TO', (payload: unknown) => {
      this.scrollToSection(payload as { oneId: number; twoId: number })
    })
    // 监听窗口滚动，实现「滚动到哪、左侧高亮到哪」
    this.scrollSub = fromEvent(window, 'scroll')
      .pipe(debounceTime(80))
      .subscribe(() => this.handleScroll())
  }

  ngOnDestroy() {
    if (this.scrollSub) {
      this.scrollSub.unsubscribe()
      this.scrollSub = null
    }
    clearTimeout(this.scrollTimer)
  }

  buildPage() {
    // filterLoginData 深拷贝并过滤 ownVisible，保证未登录访客看不到私密分类
    this.pageList = filterLoginData(this.commonService.navs(), isLogin)
  }

  // 整页模式下折叠三级分组（操作渲染副本，即时生效）
  onCollapseThree(item: INavThreeProp) {
    item.collapsed = !item.collapsed
  }

  scrollToSection(payload: { oneId: number; twoId: number }) {
    const el = payload.twoId
      ? document.getElementById(`two-${payload.twoId}`)
      : document.getElementById(`one-${payload.oneId}`)
    if (!el) return
    // 平滑滚动期间暂停 scroll-spy，避免高亮抖动
    this.disableScrollEvent = true
    clearTimeout(this.scrollTimer)
    const top = el.getBoundingClientRect().top + window.scrollY - 90
    window.scrollTo({ top, behavior: 'smooth' })
    this.scrollTimer = setTimeout(() => {
      this.disableScrollEvent = false
    }, 800)
  }

  private handleScroll() {
    if (this.disableScrollEvent) return
    if (this.commonService.searchKeyword) return
    const spyEls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-spy]'),
    )
    if (!spyEls.length) return

    // 取「视口顶部越过探针线(120px)」的最后一个分区作为当前区域
    let current: HTMLElement | null = null
    for (const el of spyEls) {
      if (el.getBoundingClientRect().top <= 120) {
        current = el
      } else {
        break
      }
    }
    // 滚动到底部时强制选中最后一个分区
    if (
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 2
    ) {
      current = spyEls[spyEls.length - 1]
    }
    if (!current) return

    const oneIndex = Number(current.dataset['oneIndex'])
    if (Number.isNaN(oneIndex)) return
    const twoIndex = Number(current.dataset['twoIndex'])
    const oneId = Number(current.dataset['oneId'])

    if (this.commonService.oneIndex !== oneIndex) {
      this.commonService.oneIndex = oneIndex
      // 通知左侧菜单展开对应一级分类
      event.emit('SIDE_SPY_ONE', oneId)
    }
    if (!Number.isNaN(twoIndex) && twoIndex >= 0) {
      this.commonService.twoIndex = twoIndex
    }
  }
}
