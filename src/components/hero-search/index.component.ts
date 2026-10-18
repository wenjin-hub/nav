import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Router, ActivatedRoute } from '@angular/router'
import { settings } from 'src/store'

interface EngineCfg {
  name: string
  url: string
}
interface CategoryCfg {
  name: string
  engines: EngineCfg[]
}

// 未配置时的默认类别（后台「系统设置 → 首页搜索区」可增删改）
export const DEFAULT_SEARCH_CATEGORIES: CategoryCfg[] = [
  {
    name: '站内',
    engines: [],
  },
  {
    name: '搜索',
    engines: [
      { name: '百度', url: 'https://www.baidu.com/s?wd=${q}' },
      { name: '必应', url: 'https://www.bing.com/search?q=${q}' },
      { name: '谷歌', url: 'https://www.google.com/search?q=${q}' },
      { name: 'GitHub', url: 'https://github.com/search?q=${q}' },
    ],
  },
  {
    name: '网盘',
    engines: [
      { name: '大盘搜', url: 'https://dapanso.com/search?q=${q}' },
      { name: 'PanHub', url: 'https://panhub.shenzjd.com/?kw=${q}' },
    ],
  },
]

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-hero-search',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export class HeroSearchComponent {
  @Input() images: { src: string; url?: string }[] = []
  @Input() height: number = 320

  keyword = ''
  activeCat = 0
  activeEngineMap: Record<number, number> = {}

  categories: CategoryCfg[] =
    (settings().searchCategories?.length || 0) > 0
      ? (settings().searchCategories as CategoryCfg[])
      : DEFAULT_SEARCH_CATEGORIES

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {}

  get currentBg(): string {
    return this.images?.[0]?.src || ''
  }

  selectCat(i: number) {
    this.activeCat = i
  }

  getActiveEngineIdx(): number {
    return this.activeEngineMap[this.activeCat] || 0
  }

  selectEngine(ei: number) {
    this.activeEngineMap[this.activeCat] = ei
  }

  enginesOf(i: number): EngineCfg[] {
    return this.categories[i]?.engines || []
  }

  trigger(e: Event) {
    const ke = e as KeyboardEvent
    if (ke.type === 'keydown' && ke.isComposing) return
    const kw = this.keyword.trim()
    if (!kw) return
    const cat = this.categories[this.activeCat]
    if (!cat) return

    // 没配搜索引擎的类别 = 站内搜索（复用 q 参数过滤整页）
    if (cat.name === '站内' || !cat.engines?.length) {
      this.router.navigate([], {
        relativeTo: this.activatedRoute,
        queryParams: { q: kw, _: Date.now() },
      })
      return
    }

    const engine = cat.engines[this.getActiveEngineIdx()] || cat.engines[0]
    if (!engine?.url) return
    const url = engine.url.includes('${q}')
      ? engine.url.replaceAll('${q}', encodeURIComponent(kw))
      : engine.url + encodeURIComponent(kw)
    window.open(url)
  }
}
