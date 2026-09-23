<template>
  <div class="elegant-app">
    <header v-if="route.meta.requiresAuth" class="static-layout">
      <button class="site-logo" type="button" @click="router.push('/dashboard')">
        <span v-if="siteConfig.showLogo" class="site-logo-mark">
          <img v-if="siteConfig.showLogo" src="/images/logo.png" :alt="siteConfig.siteName" class="site-logo-img" />
        </span>
        <span class="site-logo-name">{{ siteConfig.siteName }}</span>
      </button>

      <SlideTabsNav />

      <div class="top-toolbar">
        <ThemeToggle />
        <LanguageSelector />
        <button
          class="gift-card-shortcut"
          type="button"
          :title="$t('profile.giftCard')"
          :aria-label="$t('profile.giftCard')"
          @click="router.push('/profile')"
        >
          <IconGift :size="19" :stroke-width="1.8" aria-hidden="true" />
        </button>
        <UserAvatar :username="username" :avatarUrl="avatarUrl" />
      </div>
    </header>

    <div v-if="!route.meta.requiresAuth && route.path.includes('/auth')" class="auth-toolbar">
      <LanguageSelector />
    </div>

    <router-view v-slot="{ Component, route: viewRoute }">
      <transition name="page-transition" mode="out-in" appear>
        <keep-alive :include="cachedRoutes" :max="5">
          <component :is="Component" :key="viewRoute.path" :is-active="true" />
        </keep-alive>
      </transition>
    </router-view>

    <Toast />
    <BackToTop />
    <CustomContextMenu />
    <CustomerServiceIcon v-if="route.path !== '/customer-service'" />
    <CrispEmbed v-if="customerServiceConfig.embedMode === 'embed'" />
    <ResourcePreloader />
    <IconDefinitions />
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { useStore } from '@/store/useLegacyStore';
import { useTheme } from '@/composables/useTheme';
import { SITE_CONFIG, PROFILE_CONFIG, CUSTOMER_SERVICE_CONFIG } from '@/utils/baseConfig';
import { checkAuthAndReloadMessages } from '@/utils/authUtils';
import { checkUserLoginStatus } from '@/api/auth';
import { handleRedirectPath } from '@/utils/redirectHandler';
import { useToast } from '@/composables/useToast';
import pageCache from '@/utils/pageCache';
import Toast from '@/components/common/Toast.vue';
import BackToTop from '@/components/common/BackToTop.vue';
import CustomContextMenu from '@/components/common/CustomContextMenu.vue';
import CustomerServiceIcon from '@/components/common/CustomerServiceIcon.vue';
import CrispEmbed from '@/components/common/CrispEmbed.vue';
import ResourcePreloader from '@/components/common/ResourcePreloader.vue';
import IconDefinitions from '@/components/icons/IconDefinitions.vue';
import SlideTabsNav from '@/components/common/SlideTabsNav.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import LanguageSelector from '@/components/common/LanguageSelector.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { IconGift } from '@tabler/icons-vue';

NProgress.configure({ showSpinner: false, easing: 'ease', speed: 220, minimum: 0.18 });

const ROUTE_PROGRESS_DELAY = 180;

export default {
  name: 'App',
  components: {
    Toast,
    BackToTop,
    CustomContextMenu,
    CustomerServiceIcon,
    CrispEmbed,
    ResourcePreloader,
    IconDefinitions,
    SlideTabsNav,
    ThemeToggle,
    LanguageSelector,
    UserAvatar,
    IconGift
  },
  setup() {
    const router = useRouter();
    const route = useRoute();
    const store = useStore();
    const { applyTheme } = useTheme();
    const siteConfig = ref(SITE_CONFIG);
    const cachedRoutes = computed(() => pageCache.getCachedRoutes());
    const customerServiceConfig = computed(() => CUSTOMER_SERVICE_CONFIG);
    const languageChangedSignal = ref(0);
    const { showToast } = useToast();
    let visibilityRefreshInFlight = false;
    let lastVisibilityRefreshAt = 0;
    const visibilityRefreshCooldown = 20000;
    let routeProgressTimer = null;
    let routeProgressVisible = false;
    let routeProgressTarget = '';

    const finishRouteProgress = (target = '') => {
      if (target && target !== routeProgressTarget) return;

      if (routeProgressTimer) {
        window.clearTimeout(routeProgressTimer);
        routeProgressTimer = null;
      }

      if (routeProgressVisible) {
        NProgress.done();
        routeProgressVisible = false;
      }

      routeProgressTarget = '';
    };

    router.beforeEach((to, from, next) => {
      if (to.meta.keepAlive && to.name) pageCache.addRouteToCache(to.name);
      if (from.name && from.meta.keepAlive === false) pageCache.removeRouteFromCache(from.name);

      finishRouteProgress();
      if (to.path !== from.path) {
        routeProgressTarget = to.fullPath;
        routeProgressTimer = window.setTimeout(() => {
          if (routeProgressTarget !== to.fullPath) return;
          routeProgressTimer = null;
          routeProgressVisible = true;
          NProgress.start();
        }, ROUTE_PROGRESS_DELAY);
      }
      next();
    });
    router.afterEach(to => finishRouteProgress(to.fullPath));
    router.onError(finishRouteProgress);

    const handleRedirectParam = () => {
      let redirectParam = route.query.redirect;
      const hashParts = window.location.hash.split('?');
      if (!redirectParam && hashParts.length > 1) redirectParam = new URLSearchParams(hashParts[1]).get('redirect');
      if (typeof redirectParam === 'string') {
        const targetPath = handleRedirectPath(redirectParam);
        if (route.path !== targetPath) router.replace(targetPath);
      }
    };

    watch(() => route.fullPath, handleRedirectParam);

    const username = computed(() => store.getters.username);
    const avatarUrl = computed(() => store.getters.avatarUrl || '');
    const onLanguageChanged = () => {
      languageChangedSignal.value += 1;
      document.body.classList.add('language-transitioning');
      window.setTimeout(() => document.body.classList.remove('language-transitioning'), 300);
    };

    const handleVisibilityChange = async () => {
      if (document.hidden || visibilityRefreshInFlight) return;

      const now = Date.now();
      if (now - lastVisibilityRefreshAt < visibilityRefreshCooldown) return;

      visibilityRefreshInFlight = true;
      lastVisibilityRefreshAt = now;

      try {
        await checkAuthAndReloadMessages();
        const result = await checkUserLoginStatus();
        if (result.isLoggedIn === false && result.message) showToast(result.message, 'warning');
      } catch {
        // A transient network error should not interrupt the page restore.
      } finally {
        visibilityRefreshInFlight = false;
      }
    };

    const clearCache = () => pageCache.clearCache();
    const removeCachedRoute = routeName => pageCache.removeRouteFromCache(routeName);
    provide('languageChangedSignal', languageChangedSignal);
    provide('clearCache', clearCache);
    provide('removeCachedRoute', removeCachedRoute);

    onMounted(() => {
      window.addEventListener('languageChanged', onLanguageChanged);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      applyTheme(store.getters.currentTheme || 'light');
      checkAuthAndReloadMessages();
      handleRedirectParam();
    });

    onUnmounted(() => {
      window.removeEventListener('languageChanged', onLanguageChanged);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      finishRouteProgress();
    });

    return {
      router,
      route,
      username,
      avatarUrl,
      siteConfig,
      PROFILE_CONFIG,
      cachedRoutes,
      customerServiceConfig
    };
  }
};
</script>

<style lang="scss">
.elegant-app {
  min-height: 100vh;
}

.page-transition-enter-active,
.page-transition-leave-active {
  transition: opacity 140ms ease;
  will-change: opacity;
}

.page-transition-enter-from,
.page-transition-leave-to {
  opacity: 0;
}

.language-transitioning .language-transition-item {
  animation: language-fade 180ms ease-out;
}

@keyframes language-fade {
  from { opacity: .35; }
  to { opacity: 1; }
}

#nprogress .bar {
  background: #36a88f;
  height: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .page-transition-enter-active,
  .page-transition-leave-active {
    transition: none;
  }
}
</style>
