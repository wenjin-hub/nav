// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/liuzi6612/nav
import event from 'src/utils/mitt'
import localforage from 'localforage'
import navConfig from '../../nav.config.json'
import dbJson from '../../data/db.json'
import { updateFileContent, getRemoteDb } from 'src/api'
import { isLogin, isAccessUnlocked } from './user'
import { IWebProps, INavProps } from '../types'
import { navs } from 'src/store'
import { STORAGE_KEY_MAP, DB_PATH } from 'src/constants'
import { isSelfDevelop } from './utils'
import { queryString, getClassById } from './index'
import { $t } from 'src/locale'
import { filterLoginData, dfsNavs, cleanWebAttrs } from './pureUtils'

// 全局脏标记：任何会修改数据的操作（导入书签/编辑/删除/移动）后为 true，
// 同步成功后复位。放在模块级而不是网站管理组件里，
// 避免「先在别的页面改动、之后才进入网站管理」时监听者还没创建、标记丢失。
// 同时持久化到 localforage：跨刷新、跨构建存活，用于保护未同步的本机修改。
const DB_DIRTY_KEY = 'WEBSITE_DB_DIRTY'

let dbDirty = false

export function markDbDirty(v: boolean) {
  dbDirty = v
  localforage.setItem(DB_DIRTY_KEY, v).catch(() => {})
}

export function isDbDirty() {
  return dbDirty
}

async function getDbDirty(): Promise<boolean> {
  try {
    return (await localforage.getItem(DB_DIRTY_KEY)) === true || dbDirty
  } catch {
    return dbDirty
  }
}

// 数据变更统一出口：标记待保存 + 广播各页面刷新
export function emitDataChanged() {
  markDbDirty(true)
  event.emit('WEB_REFRESH')
}

// 前端单次改动（编辑网址/新增/删除/分类修改）的数据出口：
// 先落本机缓存，已登录且非自有部署时立即提交远端仓库——
// 用户点「保存」即真保存，不再依赖去「网站管理」手动同步。
// 提交失败时数据仍在本机，自动标记脏（网站管理「保 存」可重试）并通知。
export function commitNavs(navsData: INavProps[], message: string) {
  setNavs(navsData).catch(() => {})
  if (!isLogin || isSelfDevelop) return
  updateFileContent({
    message,
    content: JSON.stringify(cleanWebAttrs(navsData)),
    path: DB_PATH,
  })
    .then(() => {
      markDbDirty(false)
    })
    .catch((e: any) => {
      markDbDirty(true)
      event.emit('NOTIFICATION', {
        type: 'error',
        title: $t('_error'),
        content:
          '改动已保存到本机，但同步到线上失败：' +
          (e?.message || '网络异常') +
          '。请稍后到「网站管理」点「保 存」重试',
        config: {
          nzDuration: 0,
        },
      })
    })
}

// 热更新应用远端数据时，保留本机的折叠状态等界面易变属性（远端不含这些字段）
function mergeVolatile(remote: any[], cached: any): any[] {
  try {
    if (!Array.isArray(cached)) return remote
    const map = new Map<number, any>()
    const index = (list: any[]) => {
      for (const n of list || []) {
        if (n && typeof n.id === 'number') map.set(n.id, n)
        if (Array.isArray(n.nav)) index(n.nav)
      }
    }
    index(cached)
    const apply = (list: any[]) => {
      for (const n of list || []) {
        const old = typeof n.id === 'number' ? map.get(n.id) : null
        if (old && old.collapsed) n.collapsed = true
        if (Array.isArray(n.nav)) apply(n.nav)
      }
    }
    apply(remote)
    return remote
  } catch {
    return remote
  }
}

// 后台热更新：初始渲染完成后拉取线上仓库最新数据。
// 站长在网站上点「保存」→ 提交 GitHub → 任何设备刷新页面即可拿到最新数据，
// 不再依赖 Cloudflare 重新构建（构建经常滞后甚至不触发）。
function backgroundRefresh() {
  if (isSelfDevelop) return
  if (!isLogin && !isAccessUnlocked()) return
  setTimeout(async () => {
    try {
      const remote = await getRemoteDb()
      if (!remote || !Array.isArray(remote) || remote.length === 0) return
      const bundledStr = JSON.stringify(dbJson)
      const remoteStr = JSON.stringify(remote)
      // 线上与打包数据一致，无需更新
      if (remoteStr === bundledStr) return
      // 本机有未同步的修改（持久化脏标记）→ 不覆盖，等「保 存」
      // 注意不能再用「缓存内容与远端不同」判断：那会把其他设备的干净旧缓存
      // 永久卡在旧数据上（隔天不更新的另一个根源）
      if (await getDbDirty()) return
      const cached: any = await localforage.getItem(STORAGE_KEY_MAP.WEBSITE)
      const merged = mergeVolatile(remote, cached)
      setNavs(merged)
      navs.set(filterLoginData(merged, isLogin || isAccessUnlocked()))
      event.emit('WEB_REFRESH')
    } catch {
      // 静默失败，不打扰用户
    }
  }, 3000)
}

export async function getNavs() {
  if (isSelfDevelop) {
    return
  }
  function finish(navsData: INavProps[]) {
    navs.set(navsData)
    event.emit('WEB_FINISH')
    window.__FINISHED__ = true
    backgroundRefresh()
  }
  // 访客通过访问密码解锁后，与登录用户一样可见全部数据
  const data = filterLoginData(navs(), isLogin || isAccessUnlocked())

  const storageDate = window.localStorage.getItem(STORAGE_KEY_MAP.DATE_TIME)

  // 检测到新构建：仅更新本机时间标记并提示。
  // 绝不清空数据缓存——清空会把尚未同步的本机修改一并抹掉（前端编辑丢失的根源），
  // 也会让缓存回退到打包内置的旧快照；数据新鲜度由 backgroundRefresh 热更新兜底
  // （渲染后 3 秒拉线上最新，无未同步修改时自动应用）。
  if (storageDate !== navConfig.datetime) {
    globalThis.localStorage.setItem(
      STORAGE_KEY_MAP.DATE_TIME,
      navConfig.datetime,
    )
    if (isLogin) {
      setTimeout(() => {
        event.emit('NOTIFICATION', {
          type: 'success',
          title: $t('_buildSuccess'),
          content: navConfig.datetime,
          config: {
            nzDuration: 0,
          },
        })
      }, 1000)
    }
  }

  if (!isLogin) {
    // 访客：未解锁直接用过滤后的快照；解锁后读本机修改记录（localforage）
    if (isAccessUnlocked()) {
      try {
        const cached: any = await localforage.getItem(STORAGE_KEY_MAP.WEBSITE)
        finish(cached || data)
      } catch {
        finish(data)
      }
      return
    }
    return finish(data)
  }

  try {
    const navsData: any =
      (await localforage.getItem(STORAGE_KEY_MAP.WEBSITE)) || data
    finish(navsData)
  } catch {
    finish(data)
  }
}

export function setNavs(navs: INavProps[]): Promise<any> {
  if (isSelfDevelop) {
    return updateFileContent({
      content: JSON.stringify(navs),
      path: DB_PATH,
    })
  }
  return localforage.setItem(STORAGE_KEY_MAP.WEBSITE, navs)
}

export function toggleCollapseAll(navs: INavProps[]): boolean {
  const { id } = queryString()
  const { oneIndex, twoIndex } = getClassById(id)
  const collapsed = !navs[oneIndex].nav[twoIndex].collapsed
  navs[oneIndex].nav[twoIndex].collapsed = collapsed
  navs[oneIndex].nav[twoIndex].nav.map((item) => {
    item.collapsed = collapsed
    return item
  })
  // 折叠状态只对 GitHub 登录用户或本地开发落盘：解锁访客落盘会把不含私密分类的
  // 过滤快照写进缓存，导致解锁后重新加载时私密分类丢失
  if (isLogin || isSelfDevelop) {
    setNavs(navs)
  }
  return collapsed
}

export async function deleteByIds(
  ids: number[],
  isDelRid = false,
): Promise<boolean> {
  let hasDelete = false
  const navsData = dfsNavs({
    navs: navs(),
    filter: (w) => {
      if (ids.includes(isDelRid ? (w.rId as number) : w.id)) {
        hasDelete = true
        return false
      }
      return true
    },
  })
  if (hasDelete) {
    // 网站管理（#/system）走统一「保 存」：只落本机并标脏；
    // 前端页面的删除没有「保 存」入口，立即同步远端
    const inAdmin = String(globalThis.location?.hash || '').includes('/system')
    if (inAdmin) {
      await setNavs(navsData)
      if (!isSelfDevelop) {
        navs.set(navsData)
        emitDataChanged()
      }
    } else {
      navs.set(navsData)
      commitNavs(navsData, 'delete web')
      if (!isSelfDevelop) {
        event.emit('WEB_REFRESH')
      }
    }
  }
  return hasDelete
}

export function updateByWeb(oldId: number, newData: IWebProps) {
  const keys = Object.keys(newData)
  let ok = false

  const navsData = dfsNavs({
    navs: navs(),
    webCallback: (item) => {
      if (item.id === oldId) {
        ok = true
        for (let k of keys) {
          item[k] = newData[k]
        }
      }
      return ok
    },
  })
  navs.set(navsData)
  commitNavs(navsData, 'edit web')
  if (!isSelfDevelop) {
    event.emit('WEB_REFRESH')
  }
  return ok
}

export function getWebById(id: number): IWebProps | null {
  let web: IWebProps | null = null

  dfsNavs({
    navs: navs(),
    webCallback: (item) => {
      if (item.id === id) {
        web = item
        return true
      }
      return false
    },
  })
  return web
}

export function updateByClass(oldId: number, newData: any) {
  const keys = Object.keys(newData)
  let ok = false

  const navsData = dfsNavs({
    navs: navs(),
    callback: (item) => {
      if (item.id === oldId) {
        ok = true
        for (let k of keys) {
          item[k] = newData[k]
        }
      }
      return ok
    },
  })
  navs.set(navsData)
  commitNavs(navsData, 'edit class')
  if (!isSelfDevelop) {
    event.emit('WEB_REFRESH')
  }
  return ok
}

export function pushDataByAny(parentId: number, data: any): boolean {
  let ok = false

  const navsData = dfsNavs({
    navs: navs(),
    callback: (item) => {
      if (item.id === parentId) {
        ok = true
        item.nav.unshift(data)
      }
    },
  })
  navs.set(navsData)
  commitNavs(navsData, 'create web')
  if (!isSelfDevelop) {
    event.emit('WEB_REFRESH')
  }
  return ok
}
