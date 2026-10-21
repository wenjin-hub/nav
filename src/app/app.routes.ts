import { Routes } from '@angular/router'
import LightComponent from 'src/view/light/index.component'
import SuperComponent from 'src/view/super/index.component'
import SimComponent from 'src/view/sim/index.component'
import SideComponent from 'src/view/side/index.component'
import ShortcutComponent from 'src/view/shortcut/index.component'
import MobileComponent from 'src/view/mobile/index.component'
import SystemWebComponent from 'src/view/system/web/index.component'
import SystemSettingComponent from 'src/view/system/setting/index.component'
import SystemTagComponent from 'src/view/system/tag/index.component'
import SystemSearchComponent from 'src/view/system/search/index.component'
import SystemBookmarkComponent from 'src/view/system/bookmark/index.component'
import SystemBookmarkExportComponent from 'src/view/system/bookmark-export/index.component'
import SystemCollectComponent from 'src/view/system/collect/index.component'
import SystemAuthComponent from 'src/view/system/auth/index.component'
import SystemInfoComponent from 'src/view/system/info/index.component'
import SystemComponentComponent from 'src/view/system/component/index.component'
import SystemConfigComponent from 'src/view/system/config/index.component'
import { isSelfDevelop } from 'src/utils/utils'
import { getDefaultTheme } from 'src/utils'

export const routes: Routes = [
  {
    path: 'sim',
    component: SimComponent,
    data: {},
  },
  {
    path: 'super',
    component: SuperComponent,
    data: {},
  },
  {
    path: 'side',
    component: SideComponent,
    data: {},
  },
  {
    path: 'shortcut',
    component: ShortcutComponent,
    data: {},
  },

  {
    path: 'light',
    component: LightComponent,
    data: {
      data: {},
    },
  },
  {
    path: 'app',
    component: MobileComponent,
    data: {},
  },
  {
    path: 'system',
    loadComponent: () => import('src/view/system/index.component'),
    // 后台子页面全部静态引入：随主框架一次加载，
    // 切换菜单不再依赖网络加载代码块（弱网下会「点了没反应」）
    children: [
      {
        path: 'info',
        component: SystemInfoComponent,
      },
      {
        path: 'bookmark',
        component: SystemBookmarkComponent,
      },
      {
        path: 'bookmarkExport',
        component: SystemBookmarkExportComponent,
      },
      {
        path: 'collect',
        component: SystemCollectComponent,
      },
      {
        path: 'auth',
        component: SystemAuthComponent,
      },
      {
        path: 'tag',
        component: SystemTagComponent,
      },
      {
        path: 'search',
        component: SystemSearchComponent,
      },
      {
        path: 'setting',
        component: SystemSettingComponent,
      },
      {
        path: 'component',
        component: SystemComponentComponent,
      },
      {
        path: 'web',
        component: SystemWebComponent,
      },
      {
        path: 'config',
        component: SystemConfigComponent,
      },
      {
        path: '**',
        redirectTo: '/system/web',
      },
    ],
  },
]

// 自有部署异步
if (!isSelfDevelop) {
  const defaultTheme = getDefaultTheme().toLowerCase()
  const hasDefault = routes.find((item) => item.path === defaultTheme)
  if (hasDefault) {
    routes.push({
      ...hasDefault,
      path: '**',
    })
  } else {
    routes.push({
      path: '**',
      redirectTo: '/' + defaultTheme,
    })
  }
}
