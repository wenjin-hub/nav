// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xie.jiahe. All rights reserved.
// See https://github.com/liuzi6612/nav

import { Component, AfterViewInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NzInputModule } from 'ng-zorro-antd/input'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { NzMessageService } from 'ng-zorro-antd/message'
import { NzIconModule } from 'ng-zorro-antd/icon'
import { CommonService } from 'src/services/common'
import {
  isAccessUnlocked,
  setAccessUnlocked,
  hashAccessPwd,
  isLogin,
} from 'src/utils/user'
import { editMode, navs } from 'src/store'
import { updateFileContent } from 'src/api'
import { DB_PATH } from 'src/constants'
import { cleanWebAttrs } from 'src/utils/pureUtils'

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
  ],
  selector: 'app-access-login',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
  providers: [NzMessageService],
})
export class AccessLoginComponent implements AfterViewInit {
  readonly isUnlocked = isAccessUnlocked()
  readonly isLogin = isLogin
  readonly editMode = editMode
  open = false
  loading = false
  saving = false
  pwd = ''

  constructor(
    public commonService: CommonService,
    private message: NzMessageService,
  ) {}

  ngAfterViewInit() {
    // 已解锁时加载不蒜子访问统计（脚本需在统计节点渲染完成后加载）
    if (this.isUnlocked && !document.getElementById('busuanzi-script')) {
      const s = document.createElement('script')
      s.id = 'busuanzi-script'
      s.async = true
      s.src = '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'
      document.body.appendChild(s)
    }
  }

  async submit() {
    if (this.loading) return
    const target = this.commonService.settings().accessPwdHash
    if (!target) {
      this.message.warning('站长尚未设置访问密码')
      return
    }
    const pwd = this.pwd.trim()
    if (!pwd) {
      this.message.warning('请输入访问密码')
      return
    }
    this.loading = true
    try {
      const hash = await hashAccessPwd(pwd)
      if (hash !== target) {
        this.message.error('密码错误')
        return
      }
      setAccessUnlocked(true)
      // 重新加载数据（解除私密分类隐藏）
      location.reload()
    } finally {
      this.loading = false
    }
  }

  toggleEdit() {
    editMode.set(!editMode())
    if (editMode()) {
      this.message.info('已进入编辑模式：鼠标悬停网址可 编辑 / 移动 / 删除')
    }
  }

  async saveAll() {
    if (this.saving) return
    editMode.set(false)
    if (!isLogin) {
      // 无 GitHub 同步令牌：修改已通过 localforage 保存在本机
      this.message.warning(
        '当前浏览器未配置同步令牌，修改仅保存在本机；要在所有设备生效，请在已登录后台的浏览器同步',
      )
      return
    }
    this.saving = true
    try {
      await updateFileContent({
        message: 'update db',
        content: JSON.stringify(cleanWebAttrs(navs())),
        path: DB_PATH,
      })
      this.message.success('已同步到仓库，所有设备刷新页面即可生效（约几秒）')
    } catch (e: any) {
      this.message.error('同步失败：' + (e?.message || '未知错误'))
    } finally {
      this.saving = false
    }
  }

  logout() {
    setAccessUnlocked(false)
    location.reload()
  }
}
