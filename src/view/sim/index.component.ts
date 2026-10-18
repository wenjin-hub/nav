// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/liuzi6612/nav

import {
  Component,
  ViewChild,
  ElementRef,
  ViewChildren,
  QueryList,
  HostListener,
  OnDestroy,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { settings } from 'src/store'
import { compilerTemplate } from 'src/utils/utils'
import { scrollIntoViewLeft } from 'src/utils'
import { CommonService } from 'src/services/common'
import { ComponentGroupComponent } from 'src/components/component-group/index.component'
import { WebMoreMenuComponent } from 'src/components/web-more-menu/index.component'
import { SearchComponent } from 'src/components/search/index.component'
import { NzSpinModule } from 'ng-zorro-antd/spin'
import { NzTooltipModule } from 'ng-zorro-antd/tooltip'
import { CardComponent } from 'src/components/card/index.component'
import { NoDataComponent } from 'src/components/no-data/no-data.component'
import { FooterComponent } from 'src/components/footer/footer.component'
import { FixbarComponent } from 'src/components/fixbar/index.component'
import { HeroSearchComponent } from 'src/components/hero-search/index.component'
import { AccessLoginComponent } from 'src/components/access-login/index.component'
import { SafeHtmlPipe } from 'src/pipe/safeHtml.pipe'
import { ToolbarTitleWebComponent } from 'src/components/toolbar-title/index.component'
import { ClassTabsComponent } from 'src/components/class-tabs/index.component'
import type { INavProps } from 'src/types'
import { SidebarComponent } from 'src/components/sidebar/index.component'

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ToolbarTitleWebComponent,
    ComponentGroupComponent,
    WebMoreMenuComponent,
    SearchComponent,
    NzSpinModule,
    NzTooltipModule,
    CardComponent,
    NoDataComponent,
    FooterComponent,
    FixbarComponent,
    HeroSearchComponent,
    AccessLoginComponent,
    SafeHtmlPipe,
    ClassTabsComponent,
    SidebarComponent,
  ],
  selector: 'app-sim',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class SimComponent implements OnDestroy {
  @ViewChild('parent') parentRef!: ElementRef
  @ViewChildren('item') itemsRef!: QueryList<ElementRef>

  readonly description: string = compilerTemplate(settings().simThemeDesc)

  // 滚轮切换一级分类的锁，防止一次滚动连跳多个分类
  private wheelLock = false

  constructor(public commonService: CommonService) {}

  ngOnDestroy() {
    this.commonService.setOverIndex()
  }

  get isEllipsis() {
    return this.commonService.settings().simOverType === 'ellipsis'
  }

  ngAfterViewInit() {
    if (this.isEllipsis) {
      this.commonService.getOverIndex('.top-nav .over-item')
    } else {
      scrollIntoViewLeft(
        this.parentRef.nativeElement,
        this.itemsRef.toArray()[this.commonService.oneIndex].nativeElement,
        {
          behavior: 'auto',
        },
      )
    }
  }

  handleClickTop(e: any, data: INavProps) {
    this.commonService.handleClickClass(data.id)
    if (!this.isEllipsis) {
      scrollIntoViewLeft(this.parentRef.nativeElement, e.target)
    }
  }

  // 滚动鼠标滚轮：页面滚到底部继续下滚 → 切换到下一个一级分类；顶部继续上滚 → 上一个
  @HostListener('window:wheel', ['$event'])
  onWheel(e: WheelEvent) {
    if (this.wheelLock) return
    if (this.commonService.searchKeyword) return
    const doc = document.documentElement
    const atTop = window.scrollY <= 1
    const atBottom =
      window.scrollY + window.innerHeight >= doc.scrollHeight - 2
    if (!atTop && !atBottom) return

    const dir = e.deltaY > 0 ? 1 : -1
    if (dir < 0 && !atTop) return
    if (dir > 0 && !atBottom) return

    const list = this.commonService.navs() || []
    const next = this.commonService.oneIndex + dir
    if (next < 0 || next >= list.length) return

    this.wheelLock = true
    setTimeout(() => (this.wheelLock = false), 700)
    this.commonService.handleClickClass(list[next].id)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
}
