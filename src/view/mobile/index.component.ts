// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/liuzi6612/nav

import { Component, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { CommonService } from 'src/services/common'
import { SearchComponent } from 'src/components/search/index.component'
import { HeroSearchComponent } from 'src/components/hero-search/index.component'
import { CardComponent } from 'src/components/card/index.component'
import { FooterComponent } from 'src/components/footer/footer.component'
import { ToolbarTitleWebComponent } from 'src/components/toolbar-title/index.component'
import { FixbarComponent } from 'src/components/fixbar/index.component'
import { NoDataComponent } from 'src/components/no-data/no-data.component'
import { LogoComponent } from 'src/components/logo/logo.component'
import { AccessLoginComponent } from 'src/components/access-login/index.component'
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
    HeroSearchComponent,
    CardComponent,
    FooterComponent,
    ToolbarTitleWebComponent,
    FixbarComponent,
    NoDataComponent,
    LogoComponent,
    AccessLoginComponent,
  ],
  selector: 'app-mobile',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class MobileComponent implements OnDestroy {
  // 抽屉菜单开合状态
  open: boolean = false
  // 抽屉里已展开的下级分类 id 集合（支持任意层级）
  expandedIds: Set<number> = new Set()

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
    this.scrollTo(`m-one-${one.id}`)
  }

  // ===== 抽屉分类树（递归） =====

  // 是否存在下级分类（网址不算分类）
  hasSubCats(node: any): boolean {
    return Array.isArray(node?.nav) && node.nav.some((n: any) => !n.url)
  }

  // 取下级分类列表
  subCats(node: any): any[] {
    return (node?.nav || []).filter((n: any) => !n.url)
  }

  isExpanded(id: number): boolean {
    return this.expandedIds.has(id)
  }

  // 点击箭头：展开/收起该分类的下级（不影响其他已展开项）
  toggleCat(id: number, evt: Event) {
    evt.stopPropagation()
    const next = new Set(this.expandedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    this.expandedIds = next
  }

  // 在分类子树中查找目标 id，返回祖先链（含自身）；找不到返回 null
  private findPath(list: any[], targetId: number): any[] | null {
    for (const n of list || []) {
      if (n.id === targetId) return [n]
      const sub = this.findPath(n.nav, targetId)
      if (sub) return [n, ...sub]
    }
    return null
  }

  // 抽屉分类高亮：自身是被选中的二级，或是被选中二级的祖先
  isActiveCat(one: INavProps, cat: any): boolean {
    const activeId = this.getActiveTwoId(one)
    if (!activeId) return false
    if (cat.id === activeId) return true
    const path = this.findPath([cat], activeId)
    return !!path && path.length > 1
  }

  // 点击抽屉里任意层级的分类：选中其所属二级 → 收起抽屉 → 滚动到该分类区域
  handleClickCat(one: INavProps, cat: any) {
    let two: any = cat
    const walk = (list: any[], trail: any[]): boolean => {
      for (const n of list || []) {
        if (n.id === cat.id) {
          // 挂在一级下的第一个祖先就是要选中的二级（cat 本身是二级时取自身）
          two = trail[0] || n
          return true
        }
        if (Array.isArray(n.nav) && walk(n.nav, trail.length ? [...trail, n] : [n])) {
          return true
        }
      }
      return false
    }
    walk(one.nav || [], [])
    this.selectTwo(one, two)
    this.open = false
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
