// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/liuzi6612/nav

import { Component } from '@angular/core'
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
} from '@angular/forms'
import { CommonModule } from '@angular/common'
import { $t } from 'src/locale'
import { NzMessageService } from 'ng-zorro-antd/message'
import { NzNotificationService } from 'ng-zorro-antd/notification'
import type { ISearchItemProps, ISearchProps } from 'src/types'
import { updateFileContent } from 'src/api'
import { NzModalService } from 'ng-zorro-antd/modal'
import { SEARCH_PATH, SETTING_PATH } from 'src/constants'
import { search, settings } from 'src/store'
import { DEFAULT_SEARCH_CATEGORIES } from 'src/components/hero-search/index.component'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { NzTableModule } from 'ng-zorro-antd/table'
import { NzInputModule } from 'ng-zorro-antd/input'
import { NzSwitchModule } from 'ng-zorro-antd/switch'
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm'
import { UploadImageComponent } from 'src/components/upload-image/index.component'
import { NzFormModule } from 'ng-zorro-antd/form'
import { NzSliderModule } from 'ng-zorro-antd/slider'
import { NzDividerModule } from 'ng-zorro-antd/divider'
import { isValidImg } from 'src/utils'

@Component({
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    NzButtonModule,
    NzTableModule,
    NzInputModule,
    UploadImageComponent,
    NzSwitchModule,
    NzPopconfirmModule,
    NzFormModule,
    NzSliderModule,
    NzDividerModule,
  ],
  providers: [NzModalService, NzMessageService],
  selector: 'system-tag',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class SystemSearchComponent {
  readonly $t = $t
  searchList: ISearchItemProps[] = search().list
  submitting: boolean = false
  validateForm!: FormGroup

  // ===== 首页搜索区配置（Side / App 首页大搜索框） =====
  heroCfg: { name: string; engines: { name: string; url: string }[] }[] = (
    (settings().searchCategories?.length
      ? settings().searchCategories
      : DEFAULT_SEARCH_CATEGORIES) as any[]
  ).map((c: any) => ({
    name: c.name,
    engines: (c.engines || []).map((e: any) => ({
      name: e.name,
      url: e.url,
    })),
  }))

  addHeroCategory() {
    this.heroCfg.push({ name: '新类别', engines: [] })
  }

  delHeroCategory(i: number) {
    this.heroCfg.splice(i, 1)
  }

  addHeroEngine(ci: number) {
    this.heroCfg[ci].engines.push({ name: '', url: '' })
  }

  delHeroEngine(ci: number, ei: number) {
    this.heroCfg[ci].engines.splice(ei, 1)
  }

  // 保存首页搜索区配置到 settings（无需弹确认框，独立小保存）
  async handleSaveHero() {
    if (this.heroSaving) return
    this.heroSaving = true
    try {
      await updateFileContent({
        message: 'update hero search categories',
        content: JSON.stringify({
          ...settings(),
          searchCategories: this.heroCfg
            .filter((c) => c.name.trim())
            .map((c) => ({
              name: c.name.trim(),
              engines: c.engines.filter((e) => e.name.trim() && e.url.trim()),
            })),
        }),
        path: SETTING_PATH,
      })
      this.message.success($t('_syncSuccessTip'))
    } catch (error: any) {
      this.notification.error($t('_error'), error.message)
    } finally {
      this.heroSaving = false
    }
  }
  heroSaving = false

  constructor(
    private fb: FormBuilder,
    private message: NzMessageService,
    private modal: NzModalService,
    private notification: NzNotificationService,
  ) {
    const group: any = {
      ...search(),
      list: null,
    }
    const groupPayload: any = {}
    for (const k in group) {
      if (group[k] != null) {
        groupPayload[k] = [group[k]]
      }
    }
    this.validateForm = this.fb.group(groupPayload)
  }

  onLogoChange(data: any, key: string) {
    this.validateForm.get(key)?.setValue(data.cdn || '')
  }

  handleAdd() {
    const isEmpty = this.searchList.some((item) => !item.name.trim())
    if (isEmpty) {
      return
    }
    this.searchList.unshift({
      name: '',
      url: '',
      icon: '',
      placeholder: '',
      blocked: false,
      isInner: false,
    })
  }

  handleDelete(idx: number) {
    this.searchList.splice(idx, 1)
  }

  // 上移
  moveUp(index: number): void {
    if (index === 0) {
      return
    }
    const current = this.searchList[index]
    const prev = this.searchList[index - 1]
    this.searchList[index - 1] = current
    this.searchList[index] = prev
  }

  // 下移
  moveDown(index: number): void {
    if (index === this.searchList.length - 1) {
      return
    }
    const current = this.searchList[index]
    const next = this.searchList[index + 1]
    this.searchList[index + 1] = current
    this.searchList[index] = next
  }

  async handleSubmit() {
    if (this.submitting) {
      return
    }
    this.submitting = true
    const values = this.validateForm.value
    const promises = []
    if (values.logo) {
      promises.push(isValidImg(values.logo))
    }
    if (values.darkLogo) {
      promises.push(isValidImg(values.darkLogo))
    }
    const imgValues = await Promise.all(promises)

    for (const item of imgValues) {
      if (!item.valid) {
        this.message.error(`${$t('_errLogo')}: "${item.url}"`)
        this.submitting = false
        return
      }
    }
    this.submitting = false

    this.modal.info({
      nzTitle: $t('_syncDataOut'),
      nzOkText: $t('_confirmSync'),
      nzContent: $t('_confirmSyncTip'),
      nzOnOk: () => {
        this.submitting = true
        const params: ISearchProps = {
          ...values,
          list: this.searchList.filter((item) => item.name.trim()),
        }
        updateFileContent({
          message: 'update search',
          content: JSON.stringify(params),
          path: SEARCH_PATH,
        })
          .then(() => {
            this.message.success($t('_syncSuccessTip'))
          })
          .finally(() => {
            this.submitting = false
          })
      },
    })
  }

  onChangeUpload(path: any, idx: number) {
    this.searchList[idx].icon = path.cdn
  }
}
