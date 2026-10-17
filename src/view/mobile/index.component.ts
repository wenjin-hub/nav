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
import { NoDataComponent } from 'src/components/no-data/no-data.component'
import { LogoComponent } from 'src/components/logo/logo.component'
import { filterLoginData } from 'src/utils/pureUtils'
import { isLogin } from 'src/utils/user'
import type { INavProps, INavThreeProp, INavTwoProp } from 'src/types'
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
    NoDataComponent,
    LogoComponent,
  ],
  selector: 'app-mobile',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class MobileComponent implements OnDestroy {
  // 抽屉菜单开合状态
  open: boolean = false
  // 抽屉里当前展开二级目录的一级分类 id
  expandedOneId = 0

  // 整页数据：所有一级分类（已过滤「仅自己可见」）
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
    // 监听窗口滚动，实现「滚动到哪、标签高亮到哪」
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

  // 获取某一级分类当前展示的二级分类 id（未手动选择过时默认第一个）
  getActiveTwoId(one: INavProps): number {
    return this.selectedTwo[one.id] || one.nav?.[0]?.id || 0
  }

  // 点击区域标题行的二级标签：就地切换该区域显示的网址
  selectTwo(one: INavProps, two: INavTwoProp) {
    this.selectedTwo = { ...this.selectedTwo, [one.id]: two.id }
    this.syncIndex(one.id, two.id)
  }

  // 根据 id 同步 commonService 的 oneIndex/twoIndex（驱动菜单高亮）
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

  // ===== 抽屉菜单 =====

  // 点击一级行：收起抽屉，右侧滚动到该分类区域
  handleCilckNav(one: INavProps) {
    this.open = false
    this.expandedOneId = 0
    this.scrollTo(`m-one-${one.id}`)
  }

  // 点击行尾展开图标：展开/收起该分类的二级目录
  toggleExpand(oneId: number, evt: Event) {
    evt.stopPropagation()
    this.expandedOneId = this.expandedOneId === oneId ? 0 : oneId
  }

  // 点击抽屉里的二级目录：切换区域内容，收起抽屉并滚动
  handleClickTwo(one: INavProps, two: INavTwoProp) {
    this.selectedTwo = { ...this.selectedTwo, [one.id]: two.id }
    this.syncIndex(one.id, two.id)
    this.open = false
    this.expandedOneId = 0
    this.scrollTo(`m-one-${one.id}`)
  }

  scrollTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    // 平滑滚动期间暂停 scroll-spy（顶部固定头高约 50px）
    this.disableScrollEvent = true
    clearTimeout(this.scrollTimer)
    const top = el.getBoundingClientRect().top + window.scrollY - 58
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

    const oneIdx = Number(current.dataset['oneIndex'])
    if (Number.isNaN(oneIdx)) return
    this.commonService.oneIndex = oneIdx
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
