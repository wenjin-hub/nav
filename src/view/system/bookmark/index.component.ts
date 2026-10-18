// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/liuzi6612/nav

import { Component, ViewChild, ElementRef } from '@angular/core'
import { $t } from 'src/locale'
import { NzNotificationService } from 'ng-zorro-antd/notification'
import { NzMessageService } from 'ng-zorro-antd/message'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { setNavs } from 'src/utils/web'
import { parseBookmark } from 'src/utils/bookmark'
import { NzInputModule } from 'ng-zorro-antd/input'
import { navs } from 'src/store'

// HTML 转义（收藏夹文件里不能出现裸的 & < > "）
function esc(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

@Component({
  standalone: true,
  imports: [NzInputModule, NzButtonModule],
  selector: 'system-bookmark',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class SystemBookmarkComponent {
  @ViewChild('file', { static: false }) file!: ElementRef

  readonly $t = $t

  constructor(
    private message: NzMessageService,
    private notification: NzNotificationService,
  ) {}

  ngOnInit() {}

  onClickFile() {
    this.file.nativeElement.click()
  }

  // 一键导出为浏览器收藏夹 HTML（Netscape Bookmark 格式，可直接导入浏览器）
  exportBookmarks() {
    let html =
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n' +
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n' +
      '<TITLE>Bookmarks</TITLE>\n' +
      '<H1>Bookmarks</H1>\n<DL><p>\n'

    // 折叠冗余层级：目录自身不含网址、且只有一个子目录时，用子目录代替它
    // （避免导出后出现「1.综合导航 > 1.综合导航 > 1.综合导航」的嵌套）
    const collapse = (node: any): any => {
      let cur = node
      while (
        Array.isArray(cur?.nav) &&
        cur.nav.length === 1 &&
        !cur.nav[0]['url'] &&
        Array.isArray(cur.nav[0]['nav'])
      ) {
        cur = cur.nav[0]
      }
      return cur
    }

    const walk = (list: any[], depth: number) => {
      const pad = '    '.repeat(depth)
      for (const item of list) {
        if (item['url']) {
          // 网站
          html += `${pad}<DT><A HREF="${esc(item['url'])}" ADD_DATE="${Math.floor(
            Date.now() / 1000,
          )}">${esc(item['name'])}</A>\n`
        } else if (Array.isArray(item['nav'])) {
          // 分类文件夹（先折叠同名嵌套链）
          const target = collapse(item)
          html += `${pad}<DT><H3>${esc(target['title'])}</H3>\n${pad}<DL><p>\n`
          walk(target['nav'], depth + 1)
          html += `${pad}</DL><p>\n`
        }
      }
    }
    walk(navs() as any[], 1)
    html += '</DL><p>\n'

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookmarks_${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(url)
    this.message.success('导出成功，可在浏览器书签管理中导入该文件')
  }

  onBookChange(e: any) {
    const that = this
    const { files } = e.target
    if (files.length <= 0) return
    const file = files[0]
    const fileReader = new FileReader()
    fileReader.readAsText(file)
    fileReader.onload = function () {
      const html = this.result as string
      try {
        const result = parseBookmark(html)
        if (!Array.isArray(result)) {
          that.notification.error(
            $t('_errorBookTip'),
            `${result?.message ?? ''}`,
          )
        } else {
          that.message.success($t('_importSuccess'))
          setNavs(result)
          setTimeout(() => window.location.reload(), 2000)
        }
      } catch (error: any) {
        that.notification.error($t('_errorBookTip'), `${error.message}`)
      }
      e.target.value = ''
    }
  }
}
