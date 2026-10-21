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
import { filterLoginData, dfsNavs } from './pureUtils'

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
      const cached: any = await localforage.getItem(STORAGE_KEY_MAP.WEBSITE)
      if (cached) {
        const cachedStr = JSON.stringify(cached)
        // 本机有未同步的修改（既不等于打包数据也不等于线上）→ 不覆盖，等用户点「保存」
        if (cachedStr !== bundledStr && cachedStr !== remoteStr) return
      }
      setNavs(remote)
      navs.set(filterLoginData(remote, isLogin || isAccessUnlocked()))
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

  // 检测到网站更新，清除缓存本地保存记录失效（对登录用户与解锁访客都生效）
  if (storageDate !== navConfig.datetime) {
    const removeKeys = [STORAGE_KEY_MAP.WEBSITE, STORAGE_KEY_MAP.DATE_TIME]
    Array.from({ length: globalThis.localStorage.length }, (_, i) => {
      return globalThis.localStorage.key(i)
    }).forEach((key) => {
      if (key && removeKeys.includes(key)) {
        globalThis.localStorage.removeItem(key)
      }
    })
    globalThis.localStorage.setItem(
      STORAGE_KEY_MAP.DATE_TIME,
      navConfig.datetime,
    )
    localforage.removeItem(STORAGE_KEY_MAP.WEBSITE)
    finish(data)
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
    return
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
    await setNavs(navsData)
    if (!isSelfDevelop) {
      navs.set(navsData)
      event.emit('WEB_REFRESH')
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
  setNavs(navsData)
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
  setNavs(navsData)
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
  setNavs(navsData)
  if (!isSelfDevelop) {
    event.emit('WEB_REFRESH')
  }
  return ok
}
