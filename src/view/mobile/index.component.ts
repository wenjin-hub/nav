// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/liuzi6612/nav

import { Component, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { CommonService } from 'src/services/common'
import { SearchComponent } from 'src/components/search/index.component'
import { CardComponent } from 'src/components/card/index.component'
import { FooterComponent } from 'src/components/footer/footer.component'
import { ToolbarTitleWebComponent } from 'src/components/toolbar-title/index.component'
import { FixbarComponent } from 'src/components/fixbar/index.component'
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
    SearchComponent,
    CardComponent,
    FooterComponent,
    ToolbarTitleWebComponent,
    FixbarComponent,
  ],
  selector: 'app-mobile',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class MobileComponent implements OnDestroy {
  open: boolean = false

  // 整页数据：所有一级分类（已过滤「仅自己可见」）
  pageList: INavProps[] = []

  private disableScrollEvent = false
  private scrollTimer: any = null
  private scrollSub: Subscription | null = null

  constructor(public commonService: CommonService) {
    this.buildPage()
    event.on('WEB_FINISH', () => this.buildPage())
    event.on('WEB_REFRESH', () => this.buildPage())
    // 监听窗口滚动，实现「滚动到哪、顶部标签高亮到哪」
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
    this.pageList = filterLoginData(this.commonService.navs(), isLogin)
  }

  // 整页模式下折叠三级分组（操作渲染副本，即时生效）
  onCollapseThree(item: INavThreeProp) {
    item.collapsed = !item.collapsed
  }

  // 点击汉堡菜单里的一级分类 → 滚动到对应区域
  handleCilckNav(id: number) {
    this.scrollTo(`m-one-${id}`)
    this.handleToggleOpen()
  }

  // 点击吸顶标签栏里的二级分类 → 滚动到对应区域
  handleClickTwo(id: number) {
    this.scrollTo(`m-two-${id}`)
  }

  scrollTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    // 平滑滚动期间暂停 scroll-spy（头部固定高约 50px）
    this.disableScrollEvent = true
    clearTimeout(this.scrollTimer)
    const top = el.getBoundingClientRect().top + window.scrollY - 58
    window.scrollTo({ top, behavior: 'smooth' })
    this.scrollTimer = setTimeout(() => {
      this.disableScrollEvent = false
    }, 800)
  }

  handleToggleOpen() {
    this.open = !this.open
  }

  private handleScroll() {
    if (this.disableScrollEvent) return
    if (this.commonService.searchKeyword) return
    const spyEls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-spy]'),
    )
    if (!spyEls.length) return

    let current: HTMLElement | null = null
    for (const el of spyEls) {
      if (el.getBoundingClientRect().top <= 110) {
        current = el
      } else {
        break
      }
    }
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

    this.commonService.oneIndex = oneIndex
    if (!Number.isNaN(twoIndex) && twoIndex >= 0) {
      this.commonService.twoIndex = twoIndex
    }
  }
}
