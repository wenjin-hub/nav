// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/liuzi6612/nav
import localforage from 'localforage'
import { STORAGE_KEY_MAP } from 'src/constants'
import { ActionType } from 'src/types'
import type { ISettings } from 'src/types'

export function getToken() {
  return globalThis.localStorage?.getItem(STORAGE_KEY_MAP.TOKEN) || ''
}

export function getAuthCode() {
  return globalThis.localStorage.getItem(STORAGE_KEY_MAP.AUTH_CODE) || ''
}

export function removeAuthCode() {
  return globalThis.localStorage.removeItem(STORAGE_KEY_MAP.AUTH_CODE)
}

export function setAuthCode(c: string) {
  return globalThis.localStorage.setItem(STORAGE_KEY_MAP.AUTH_CODE, c.trim())
}

export function setToken(token: string) {
  return globalThis.localStorage.setItem(STORAGE_KEY_MAP.TOKEN, token)
}

export function removeToken() {
  return globalThis.localStorage.removeItem(STORAGE_KEY_MAP.TOKEN)
}

export function getImageToken() {
  return globalThis.localStorage?.getItem(STORAGE_KEY_MAP.IMAGE_TOKEN) || ''
}

export function setImageToken(token: string) {
  return globalThis.localStorage.setItem(STORAGE_KEY_MAP.IMAGE_TOKEN, token)
}

export function removeWebsite() {
  return localforage.removeItem(STORAGE_KEY_MAP.WEBSITE)
}

export function userLogout() {
  const removeKeys = [
    STORAGE_KEY_MAP.TOKEN,
    STORAGE_KEY_MAP.IMAGE_TOKEN,
    STORAGE_KEY_MAP.WEBSITE,
  ]
  localforage.clear()
  Array.from({ length: globalThis.localStorage.length }, (_, i) => {
    return globalThis.localStorage.key(i)
  }).forEach((key) => {
    if (key && removeKeys.includes(key)) {
      globalThis.localStorage.removeItem(key)
    }
  })
  Array.from({ length: globalThis.sessionStorage.length }, (_, i) => {
    return globalThis.sessionStorage.key(i)
  }).forEach((key) => {
    if (key && removeKeys.includes(key)) {
      globalThis.sessionStorage.removeItem(key)
    }
  })
}

export const isLogin: boolean = !!getToken()

// ===== 访问密码（方案A：访客输入密码解锁「仅自己可见」内容） =====
export const ACCESS_STORAGE_KEY = 'ACCESS_UNLOCKED'

export function isAccessUnlocked(): boolean {
  return globalThis.localStorage?.getItem(ACCESS_STORAGE_KEY) === 'true'
}

export function setAccessUnlocked(v: boolean) {
  if (v) {
    globalThis.localStorage.setItem(ACCESS_STORAGE_KEY, 'true')
  } else {
    globalThis.localStorage.removeItem(ACCESS_STORAGE_KEY)
  }
}

// 访问密码哈希：加盐 SHA-256，hex 字符串（防路人级别）
export async function hashAccessPwd(pwd: string): Promise<string> {
  const data = new TextEncoder().encode('wjnav-access:' + pwd)
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

let create: null | boolean = null
let edit: null | boolean = null
let del: null | boolean = null

export function getPermissions(settings: ISettings) {
  if (create == null) {
    create = settings.userActions.includes(ActionType.Create)
    edit = settings.userActions.includes(ActionType.Edit)
    del = settings.userActions.includes(ActionType.Delete)
  }

  const c = create || false
  const e = edit || false
  const d = del || false

  return {
    create: c,
    edit: e,
    del: d,
    ok: c || e || d,
  } as const
}
