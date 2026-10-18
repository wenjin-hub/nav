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
import { HeroSearchComponent } from 'src/components/hero-search/index.component'
import { ToolbarTitleWebComponent } from 'src/components/toolbar-title/index.component'
import { WebListComponent } from 'src/components/web-list/index.component'
import { ClassTabsComponent } from 'src/components/class-tabs/index.component'
import { SidebarComponent } from 'src/components/sidebar/index.component'
import { LogoComponent } from 'src/components/logo/logo.component'
import { AccessLoginComponent } from 'src/components/access-login/index.component'
import { filterLoginData } from 'src/utils/pureUtils'
import { isLogin, isAccessUnlocked } from 'src/utils/user'
import type { INavProps, INavThreeProp, INavTwoProp } from 'src/types'
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
    LogoComponent,
    HeroSearchComponent,
    AccessLoginComponent,
  ],
  selector: 'app-side',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class SideComponent implements OnDestroy {
  readonly $t = $t

  // 整页数据：所有一级分类（已过滤「仅自己可见」，访客不可见私密分类）
  pageList: INavProps[] = []

  // 每个一级分类当前选中的二级分类 id（未选择过时默认显示第一个二级）
  selectedTwo: Record<number, number> = {}

  private disableScrollEvent = false
  private scrollTimer: any = null
  private scrollSub: Subscription | null = null

  constructor(public commonService: CommonService) {
    this.buildPage()
    event.on('WEB_FINISH', () => this.buildPage())
    event.on('WEB_REFRESH', () => this.buildPage())
    // 左侧菜单点击 → 切换区域内容 + 平滑滚动到对应区域
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
    // filterLoginData 深拷贝并过滤 ownVisible：
    // 访问密码解锁或 GitHub 登录后都可见私密分类
    this.pageList = filterLoginData(
      this.commonService.navs(),
      isLogin || isAccessUnlocked(),
    )
  }

  // 获取某一级分类当前展示的二级分类 id（未手动选择过时默认第一个）
  getActiveTwoId(one: INavProps): number {
    return this.selectedTwo[one.id] || one.nav?.[0]?.id || 0
  }

  // 点击区域标题行的二级标签：就地切换该区域显示的网址
  selectTwo(one: INavProps, two: INavTwoProp) {
    this.selectedTwo = { ...this.selectedTwo, [one.id]: two.id }
    this.syncIndex(one.id, two.id)
  }

  // 根据 id 同步 commonService 的 oneIndex/twoIndex（驱动左侧菜单高亮）
  private syncIndex(oneId: number, twoId: number) {
    const oneIdx = this.pageList.findIndex((n) => n.id === oneId)
    if (oneIdx === -1) return
    this.commonService.oneIndex = oneIdx
    const twoIdx = this.pageList[oneIdx].nav.findIndex((t) => t.id === twoId)
    if (twoIdx > -1) {
      this.commonService.twoIndex = twoIdx
    }
  }

  // 整页模式下折叠三级分组（操作渲染副本，即时生效）
  onCollapseThree(item: INavThreeProp) {
    item.collapsed = !item.collapsed
  }

  scrollToSection(payload: { oneId: number; twoId: number }) {
    if (payload.twoId) {
      // 点了二级目录：该区域切换到对应二级
      this.selectedTwo = {
        ...this.selectedTwo,
        [payload.oneId]: payload.twoId,
      }
      this.syncIndex(payload.oneId, payload.twoId)
    }
    const el = document.getElementById(`one-${payload.oneId}`)
    if (!el) return
    // 平滑滚动期间暂停 scroll-spy，避免高亮抖动
    this.disableScrollEvent = true
    clearTimeout(this.scrollTimer)
    const top = el.getBoundingClientRect().top + window.scrollY - 16
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

    // 取「视口顶部越过探针线(120px)」的最后一个一级区域作为当前区域
    let current: HTMLElement | null = null
    for (const el of spyEls) {
      if (el.getBoundingClientRect().top <= 120) {
        current = el
      } else {
        break
      }
    }
    // 滚动到底部时强制选中最后一个区域
    if (
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 2
    ) {
      current = spyEls[spyEls.length - 1]
    }
    if (!current) return

    const oneId = Number(current.dataset['oneId'])
    const oneIdx = Number(current.dataset['oneIndex'])
    if (Number.isNaN(oneIdx)) return
    this.commonService.oneIndex = oneIdx
    // 二级高亮跟随该区域当前选中的二级标签
    const one = this.pageList[oneIdx]
    if (one?.nav?.length) {
      const activeId = this.getActiveTwoId(one)
      const twoIdx = one.nav.findIndex((t) => t.id === activeId)
      if (twoIdx > -1) {
        this.commonService.twoIndex = twoIdx
      }
    }
  }
}
