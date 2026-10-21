// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xie.jiahe. All rights reserved.
// See https://github.com/liuzi6612/nav

import type { INavProps, IWebProps, INavTwoProp, INavThreeProp } from '../types'
import { navs } from '../store'
import { $t } from '../locale'
import { getTempId } from './utils'
import { removeTrailingSlashes } from './pureUtils'

let id = getTempId()

const getTitle = (node: Element): string => (node.textContent || '').trim()
const getUrl = (node: Element): string =>
  (node.getAttribute('href') || '').trim()
const getIcon = (node: Element): string =>
  (node.getAttribute('icon') || '').trim()

function findUnclassifiedData(roolDL: Element): IWebProps[] {
  const data: IWebProps[] = []
  Array.from(roolDL.children).forEach((iItem) => {
    if (iItem.nodeName === 'DT') {
      const a = iItem.firstElementChild
      if (a?.nodeName === 'A') {
        data.push({
          name: getTitle(a),
          icon: getIcon(a),
          url: getUrl(a),
          tags: [],
          desc: '',
          rate: 5,
          id: (id += 1),
          breadcrumb: [],
        })
      }
    }
  })
  return data
}

interface BookmarkParseResult {
  message?: string
  data?: INavProps[]
  report?: {
    newCategories: number
    newWebs: number
    existCategories: number
    existWebs: number
  }
}

export function parseBookmark(
  htmlStr: string,
): BookmarkParseResult | INavProps[] {
  const copyWebList = JSON.parse(JSON.stringify(navs()))
  const data: INavProps[] = []
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlStr, 'text/html')
  const querySelector = htmlStr.includes('PERSONAL_TOOLBAR_FOLDER="true"')
    ? 'body dl dl'
    : 'body dl'
  const roolDL = doc.querySelector(querySelector)

  if (!roolDL) {
    return {
      message: '未找到dl dl节点',
    }
  }

  try {
    function processWebsiteLevel(DL3: Element, parentData: INavThreeProp) {
      Array.from(DL3.children).forEach((wItem) => {
        if (wItem.nodeName === 'DT') {
          const titleEl = wItem.querySelector('a')
          if (titleEl) {
            parentData.nav.push({
              name: getTitle(titleEl),
              url: getUrl(titleEl),
              desc: '',
              tags: [],
              rate: 5,
              top: false,
              icon: getIcon(titleEl),
              id: (id += 1),
              breadcrumb: [],
            })
          }
        }
      })
    }

    function processThreeLevel(DL3: Element, parentNav: INavTwoProp) {
      Array.from(DL3.children).forEach((kItem, index) => {
        if (kItem.nodeName === 'DT') {
          const titleEl = kItem.querySelector('h3')
          if (titleEl) {
            let title = getTitle(titleEl)
            const has = parentNav.nav.some((e) => e.title === title)
            if (has) {
              title = title + index
            }
            const threeLevel: INavThreeProp = {
              id: (id += 1),
              title,
              nav: [],
              icon: '',
            }
            parentNav.nav.push(threeLevel)

            const websiteDL = kItem.querySelector('dl')
            if (websiteDL) {
              processWebsiteLevel(websiteDL, threeLevel)
            }
          }
        }
      })
    }

    function processTwoLevel(DL: Element, parentData: INavProps) {
      Array.from(DL.children).forEach((jItem, index) => {
        if (jItem.nodeName === 'DT') {
          const titleEl = jItem.querySelector('h3')
          if (titleEl) {
            let title = getTitle(titleEl)
            const has = parentData.nav.some((e) => e.title === title)
            if (has) {
              title = title + index
            }
            const twoLevel: INavTwoProp = {
              id: (id += 1),
              title,
              icon: getIcon(titleEl),
              nav: [],
            }
            parentData.nav.push(twoLevel)

            const DL3 = jItem.querySelector('dl')
            if (DL3) {
              const unclassifiedData = findUnclassifiedData(DL3)
              if (unclassifiedData.length > 0) {
                // 未分组的网址直接挂到二级分类下（不再包同名三级壳）
                ;(twoLevel.nav as any[]).push(...unclassifiedData)
              }
              processThreeLevel(DL3, twoLevel)
            }
          }
        }
      })
    }

    // Process One Level
    Array.from(roolDL.children).forEach((iItem, index) => {
      if (iItem.nodeName === 'DT') {
        const titleEl = iItem.querySelector('h3')
        if (titleEl) {
          let title = getTitle(titleEl)
          const has = data.some((e) => e.title === title)
          if (has) {
            title = title + index
          }
          const oneLevel: INavProps = {
            id: (id += 1),
            title,
            icon: getIcon(titleEl),
            nav: [],
          }
          data.push(oneLevel)

          const DL = iItem.querySelector('dl')
          if (DL) {
            const unclassifiedData = findUnclassifiedData(DL)
            if (unclassifiedData.length > 0) {
              // 直挂网址只包一层二级分类（网址直挂二级，不再嵌套同名三级壳）
              oneLevel.nav.push({
                id: (id += 1),
                title,
                icon: '',
                nav: unclassifiedData,
              } as any)
            }
            processTwoLevel(DL, oneLevel)
          }
        }
      }
    })

    const unclassifiedData = findUnclassifiedData(roolDL)
    if (unclassifiedData.length > 0) {
      // 只包一层二级分类（网址直挂二级，不再嵌套同名三级壳）
      data.push({
        id: (id += 1),
        title: $t('_uncategorized'),
        icon: '',
        nav: [
          {
            id: (id += 1),
            title: $t('_uncategorized'),
            icon: '',
            nav: unclassifiedData,
          } as any,
        ],
      })
    }
  } catch (error) {
    console.log(error)
    throw error
  }

  // 增量导入：URL 全局去重（全树范围内已存在的网址一律跳过，
  // 保留站内已设置的名称、描述等不被导入内容覆盖）
  const normUrl = (u: unknown): string =>
    removeTrailingSlashes(String(u || '').trim())
  const existingUrls = new Set<string>()
  const collectUrls = (list: any[]) => {
    for (const item of list || []) {
      if (item.url) {
        existingUrls.add(normUrl(item.url))
      } else if (Array.isArray(item.nav)) {
        collectUrls(item.nav)
      }
    }
  }
  collectUrls(copyWebList)

  const report = {
    newCategories: 0,
    newWebs: 0,
    existCategories: 0,
    existWebs: 0,
  }

  // 分类按「祖先链路径」统计（每个导入文件夹只计一次，避免同名嵌套重复计数）
  const existingCatPaths = new Set<string>()
  const walkCatPaths = (list: any[], prefix: string[]) => {
    for (const n of list) {
      if (n.url) continue
      const p = [...prefix, String(n.title || '').trim()]
      existingCatPaths.add(p.join('/'))
      if (Array.isArray(n.nav)) walkCatPaths(n.nav, p)
    }
  }
  walkCatPaths(copyWebList, [])

  const seenCatPaths = new Set<string>()
  const seenImportUrls = new Set<string>()
  const countWalk = (list: any[], prefix: string[]) => {
    for (const n of list) {
      if (n.url) {
        const u = normUrl(n.url)
        if (seenImportUrls.has(u)) continue
        seenImportUrls.add(u)
        if (existingUrls.has(u)) {
          report.existWebs++
        } else {
          report.newWebs++
        }
        continue
      }
      const p = [...prefix, String(n.title || '').trim()]
      const key = p.join('/')
      if (!seenCatPaths.has(key)) {
        seenCatPaths.add(key)
        // 与父级同名的结构性包装层不计入分类数
        const isSameNameWrapper =
          prefix.length > 0 &&
          String(n.title || '').trim() === prefix[prefix.length - 1]
        if (!isSameNameWrapper) {
          if (existingCatPaths.has(key)) {
            report.existCategories++
          } else {
            report.newCategories++
          }
        }
      }
      if (Array.isArray(n.nav)) countWalk(n.nav, p)
    }
  }
  countWalk(data, [])

  // 合并：网址按 URL 去重，分类按标题同名合并
  function r(data: any[], list: any[]) {
    for (let i = 0; i < data.length; i++) {
      const item = data[i] as any

      if (item.url) {
        const url = normUrl(item.url)
        if (!existingUrls.has(url)) {
          list.push(item)
          existingUrls.add(url)
        }
        continue
      }

      if (!item.title) continue
      const title = item.title.trim()
      const idx = list.findIndex(
        (e) => !e.url && (e.title || '').trim() === title,
      )
      if (idx !== -1) {
        if (Array.isArray(item.nav)) {
          r(item.nav, list[idx].nav)
        }
        continue
      }
      // 新分类：先挂一个空壳再递归并入子级（URL 全局去重），
      // 不能整棵 push 后再对自身递归——那样每个新网址会被重复添加两份
      const clone: any = { ...item, nav: [] }
      list.push(clone)
      if (Array.isArray(item.nav)) {
        r(item.nav, clone.nav)
      }
    }
  }
  r(data, copyWebList)
  return { data: copyWebList, report }
}
