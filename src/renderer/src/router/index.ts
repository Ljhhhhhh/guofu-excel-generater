import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  // 使用 hash 模式 (Electron 推荐)
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/Dashboard.vue')
    },
    {
      path: '/create',
      name: 'create-contract',
      component: () => import('../views/CreateContract.vue')
    },
    {
      path: '/edit/:id',
      name: 'edit-contract',
      component: () => import('../views/EditContract.vue')
    }
  ]
})

export default router
